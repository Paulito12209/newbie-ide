/**
 * The preview bridge: the only module that talks to the iframe.
 *
 * Two distinct paths, and the difference is the whole point of this MVP:
 *
 *   patchCss()  hot path   - no reload. One postMessage that replaces the
 *                            textContent of the persistent
 *                            <style id="user-css"> element. Scroll position,
 *                            focus, JS state, timers and running animations all
 *                            survive. Callers coalesce to one animation frame;
 *                            see the scheduler in main.ts.
 *
 *   rebuild()   cold path  - a fresh document via srcdoc, because changed HTML
 *                            or JS cannot be applied to a live document without
 *                            re-running it. Debounced by the caller.
 */
import { PREVIEW_RUNTIME } from './runtime';

export interface Sources {
  html: string;
  css: string;
  js: string;
}

export interface PreviewError {
  message: string;
  line: number | null;
  column: number | null;
}

export interface PreviewOptions {
  onError: (error: PreviewError) => void;
  /** Fired when a rebuilt document has booted and can accept CSS patches. */
  onReady: () => void;
}

export interface Preview {
  rebuild(sources: Sources): void;
  patchCss(css: string): void;
  dispose(): void;
}

const OFFSET_TOKEN = '__SL_OFFSET__';

/** A user script must not be able to close its own tag and escape into markup. */
function escapeScript(code: string): string {
  return code.replace(/<\/(script)/gi, '<\\/$1');
}

function buildDocument(sources: Sources): string {
  const head =
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<style id="user-css">' +
    sources.css +
    '</style>' +
    '<script>window.__SL_JS_LINE=' +
    OFFSET_TOKEN +
    ';\n' +
    PREVIEW_RUNTIME +
    '\n<\/script></head><body>\n';

  const prefix = head + sources.html + '\n<script>\n';
  // The user's first JS line sits this many document lines down; the runtime
  // subtracts it so reported line numbers match the JS tab.
  const offset = prefix.split('\n').length - 1;

  return (
    prefix.replace(OFFSET_TOKEN, String(offset)) +
    escapeScript(sources.js) +
    '\n<\/script></body></html>'
  );
}

export function createPreview(iframe: HTMLIFrameElement, options: PreviewOptions): Preview {
  let ready = false;
  let pendingCss: string | null = null;

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
        line: error.line ?? null,
        column: error.column ?? null,
      });
    }
  }

  window.addEventListener('message', onMessage);

  function flush(): void {
    if (!ready || pendingCss === null) return;
    const code = pendingCss;
    pendingCss = null;
    iframe.contentWindow?.postMessage({ source: 'slashlearn', type: 'css', code }, '*');
  }

  return {
    rebuild(sources: Sources): void {
      ready = false;
      // The fresh document already carries the current CSS, so a rebuild never
      // flashes unstyled content and never needs a follow-up patch.
      pendingCss = null;
      iframe.srcdoc = buildDocument(sources);
    },

    /**
     * Hot path. Synchronous by design: the caller already sits inside a single
     * requestAnimationFrame, and adding a frame here would double the latency.
     * If the document is still booting, the CSS is applied the moment it is.
     */
    patchCss(css: string): void {
      pendingCss = css;
      flush();
    },

    dispose(): void {
      window.removeEventListener('message', onMessage);
    },
  };
}
