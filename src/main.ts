/**
 * Wiring, and the scheduler that decides which preview path a change takes.
 *
 * Nothing in here does layout or preview work synchronously in response to a
 * keystroke. The editor's update listener only records the new document and
 * arms a timer; everything else happens in a frame or an idle callback.
 */
import './styles.css';
import type { Text } from '@codemirror/state';
import { createEditor } from './editor/editor';
import { prefetchLanguages } from './editor/languages';
import { createPreview } from './preview/bridge';
import type { PreviewError } from './preview/bridge';
import { MOBILE_QUERY, createMobilePanes } from './ui/mobile';
import { createMenuBar } from './ui/menubar';
import { createSplitter } from './ui/splitter';
import { applyTheme } from './ui/theme';
import { createStatus } from './ui/status';
import { createTabs } from './ui/tabs';
import type { LangId } from './state';
import { persist, persistNow, session } from './state';

/** ms of typing inactivity before HTML/JS changes force a full iframe rebuild. */
const REBUILD_DEBOUNCE = 250;

const app = document.getElementById('app') as HTMLElement;
const menubarHost = document.getElementById('menubar') as HTMLElement;
const editorHost = document.getElementById('editor-host') as HTMLElement;
const tabsHost = document.getElementById('tabs') as HTMLElement;
const splitterHandle = document.getElementById('splitter') as HTMLElement;
const iframe = document.getElementById('preview') as HTMLIFrameElement;
const statusBar = document.getElementById('status') as HTMLElement;

// Before anything renders: the inline script in index.html has already set the
// attribute, this keeps the module the single source of truth afterwards.
applyTheme(session.theme);

createMenuBar(menubarHost, {
  theme: session.theme,
  onThemeChange: (mode) => {
    session.theme = mode;
    persist();
  },
});

const status = createStatus(statusBar);

/**
 * Documents whose text has changed but has not been stringified yet.
 * Converting a CodeMirror Text to a string is O(document), so it is deferred
 * out of the keystroke path and done once per frame at most.
 */
const pending: Partial<Record<LangId, Text>> = {};

function commit(lang: LangId): void {
  const doc = pending[lang];
  if (!doc) return;
  session[lang] = doc.toString();
  delete pending[lang];
}

function commitAll(): void {
  commit('html');
  commit('css');
  commit('js');
}

const preview = createPreview(iframe, {
  onReady: () => status.clear(),
  onError: (error: PreviewError) => {
    const where = error.line ? ` (script.js:${error.line}${error.column ? ':' + error.column : ''})` : '';
    status.error(error.message + where);
  },
});

// --- CSS: hot path -----------------------------------------------------------
// One frame, no debounce, no reload. The iframe keeps its scroll position,
// focus, JS state and animation timing.
let cssFrame = 0;
function scheduleCssPatch(): void {
  if (cssFrame) return;
  cssFrame = requestAnimationFrame(() => {
    cssFrame = 0;
    commit('css');
    preview.patchCss(session.css);
    persist();
  });
}

// --- HTML / JS: cold path ----------------------------------------------------
// Structure and behaviour cannot be swapped into a live document, so the whole
// document is rewritten. Debounced so a rebuild happens between keystrokes,
// never during a burst of them.
let rebuildTimer = 0;
function scheduleRebuild(): void {
  clearTimeout(rebuildTimer);
  rebuildTimer = window.setTimeout(rebuildNow, REBUILD_DEBOUNCE);
}

function rebuildNow(): void {
  clearTimeout(rebuildTimer);
  if (cssFrame) {
    cancelAnimationFrame(cssFrame);
    cssFrame = 0;
  }
  commitAll();
  status.clear('Running...');
  preview.rebuild({ html: session.html, css: session.css, js: session.js });
  persist();
}

const editor = createEditor(editorHost, {
  docs: { html: session.html, css: session.css, js: session.js },
  active: session.active,
  onDocChanged: (lang, doc) => {
    pending[lang] = doc;
    if (lang === 'css') scheduleCssPatch();
    else scheduleRebuild();
  },
});

createTabs(tabsHost, session.active, (lang) => {
  session.active = lang;
  editor.show(lang);
  persist();
});

// Two different interactions share one handle: a resize splitter on a desktop
// pointer, a pane switcher on a phone. Only one is attached at a time.
const narrow = window.matchMedia(MOBILE_QUERY);
let detachPanes: (() => void) | null = null;

function applyLayout(): void {
  detachPanes?.();
  detachPanes = narrow.matches
    ? createMobilePanes(app, splitterHandle)
    : createSplitter(app, splitterHandle, {
        initial: session.split,
        onChange: (percent) => {
          session.split = percent;
          persist();
        },
      });
}

applyLayout();
narrow.addEventListener('change', applyLayout);

// Flush anything still pending if the tab goes away mid-edit.
window.addEventListener('pagehide', () => {
  commitAll();
  persistNow();
});

rebuildNow();
prefetchLanguages();
editor.focus();

// The concept-teaching layer is a separate chunk and a separate concern: it
// attaches through the editor's extension point and nothing here depends on it.
void import('./concepts').then((concepts) => concepts.installConcepts());
