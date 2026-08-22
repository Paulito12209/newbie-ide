/**
 * The preview bridge: the only module that talks to the iframe.
 *
 * It behaves like a browser, not like a helpful IDE. A stylesheet applies
 * because the HTML links it, and a script runs because the HTML loads it -
 * nothing is wired in behind the user's back. `<link rel="stylesheet">` and
 * `<script src>` are resolved against the open files by name; anything that does
 * not match a file is left alone and fails exactly as it would on a real server.
 *
 * Two distinct paths, and the difference is the point of this MVP:
 *
 *   patchCss()  hot path   - no reload. One postMessage replaces the text of the
 *                            <style> element standing in for that stylesheet.
 *                            Scroll position, focus, JS state, timers and
 *                            running animations all survive.
 *
 *   rebuild()   cold path  - a fresh document via srcdoc, because changed HTML
 *                            or JS cannot be applied to a live document without
 *                            re-running it. Debounced by the caller.
 */
import type { FileDoc } from '../state';
import { PREVIEW_RUNTIME } from './runtime';

export interface PreviewError {
  message: string;
  file: string | null;
  line: number | null;
  column: number | null;
}

export interface PreviewOptions {
  onError: (error: PreviewError) => void;
  /** Fired when a rebuilt document has booted and can accept CSS patches. */
  onReady: () => void;
}

export interface Preview {
  rebuild(entry: FileDoc | undefined, files: readonly FileDoc[]): void;
  patchCss(name: string, code: string): void;
  dispose(): void;
}

interface ScriptRange {
  name: string;
  start: number;
  end: number;
}

/** Author text must not be able to close its own tag and escape into markup. */
function escapeClose(code: string, tag: string): string {
  return code.replace(new RegExp(`</(${tag})`, 'gi'), '<\\/$1');
}

/** `./style.css?v=2` and `style.css` are the same file here. */
function resolve(reference: string, files: readonly FileDoc[]): FileDoc | undefined {
  const clean = reference.split(/[?#]/)[0]!.replace(/^\.?\//, '').trim();
  if (!clean) return undefined;
  return files.find((file) => file.name === clean);
}

/** Wraps the file name so the marker line is a comment, not a statement. */
const marker = (name: string): string => `/*@sl:${name}*/`;

function buildDocument(
  entry: FileDoc,
  files: readonly FileDoc[],
): { html: string; scripts: ScriptRange[] } {
  const dom = new DOMParser().parseFromString(entry.text, 'text/html');
  const pending: string[] = [];

  // Stylesheets become <style> elements the hot path can address by file name.
  for (const link of Array.from(dom.querySelectorAll('link[rel~="stylesheet"][href]'))) {
    const file = resolve(link.getAttribute('href') ?? '', files);
    if (!file || file.kind !== 'css') continue;
    const style = dom.createElement('style');
    style.setAttribute('data-sl-file', file.name);
    style.textContent = escapeClose(file.text, 'style');
    link.replaceWith(style);
  }

  // Scripts are inlined, each behind a marker so a thrown error can be traced
  // back to a file and a line the user can actually find.
  for (const script of Array.from(dom.querySelectorAll('script[src]'))) {
    const file = resolve(script.getAttribute('src') ?? '', files);
    if (!file || file.kind !== 'js') continue;
    const inline = dom.createElement('script');
    for (const attribute of Array.from(script.attributes)) {
      if (attribute.name !== 'src') inline.setAttribute(attribute.name, attribute.value);
    }
    inline.textContent = `${marker(file.name)}\n${escapeClose(file.text, 'script')}`;
    pending.push(file.name);
    script.replaceWith(inline);
  }

  const runtime = dom.createElement('script');
  runtime.textContent = PREVIEW_RUNTIME;
  const head = dom.head ?? dom.documentElement;
  head.insertBefore(runtime, head.firstChild);

  let html = `<!DOCTYPE html>\n${dom.documentElement.outerHTML}`;

  // Line numbers are only knowable once the document is a string.
  const scripts: ScriptRange[] = [];
  for (const name of pending) {
    const token = `${marker(name)}\n`;
    const at = html.indexOf(token);
    if (at === -1) continue;
    const start = html.slice(0, at).split('\n').length;
    const file = files.find((entryFile) => entryFile.name === name);
    scripts.push({ name, start, end: start + (file ? file.text.split('\n').length : 0) });
  }

  const manifest = `<script>window.__SL_SCRIPTS=${JSON.stringify(scripts)};<\/script>`;
  html = html.replace('<head>', `<head>${manifest}`);
  return { html, scripts };
}

/** Nothing to render is a state worth explaining rather than a blank frame. */
function emptyDocument(): string {
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
    'body{font:13px system-ui,sans-serif;color:#666;margin:24px}' +
    '</style></head><body>No HTML file to render. Create one to see your page.</body></html>'
  );
}

export function createPreview(iframe: HTMLIFrameElement, options: PreviewOptions): Preview {
  let ready = false;
  let pending: { name: string; code: string }[] = [];

  function onMessage(event: MessageEvent): void {
    // Only accept messages from the document currently in our iframe. A stale
    // document from a previous rebuild has a different contentWindow.
    if (!iframe.contentWindow || event.source !== iframe.contentWindow) return;
    const data = event.data as { source?: string; type?: string } | null;
    if (!data || data.source !== 'slashlearn-preview') return;

    if (data.type === 'ready') {
      ready = true;
      flush();
      options.onReady();
      return;
    }
    if (data.type === 'error') {
      const error = data as unknown as PreviewError;
      options.onError({
        message: error.message,
        file: error.file ?? null,
        line: error.line ?? null,
        column: error.column ?? null,
      });
    }
  }

  window.addEventListener('message', onMessage);

  function flush(): void {
    if (!ready || pending.length === 0) return;
    const queued = pending;
    pending = [];
    for (const patch of queued) {
      iframe.contentWindow?.postMessage(
        { source: 'slashlearn', type: 'css', file: patch.name, code: patch.code },
        '*',
      );
    }
  }

  return {
    rebuild(entry, files): void {
      ready = false;
      // The fresh document already carries the current CSS, so a rebuild never
      // flashes unstyled content and never needs a follow-up patch.
      pending = [];
      iframe.srcdoc = entry ? buildDocument(entry, files).html : emptyDocument();
    },

    /**
     * Hot path. Synchronous by design: the caller already sits inside a single
     * requestAnimationFrame, and adding a frame here would double the latency.
     * If the document is still booting, the CSS is applied the moment it is.
     */
    patchCss(name, code): void {
      pending = pending.filter((patch) => patch.name !== name);
      pending.push({ name, code });
      flush();
    },

    dispose(): void {
      window.removeEventListener('message', onMessage);
    },
  };
}
