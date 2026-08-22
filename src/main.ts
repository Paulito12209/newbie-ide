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
import { openFileDialog } from './ui/dialog';
import { createMenuBar } from './ui/menubar';
import { MOBILE_QUERY, createMobilePanes } from './ui/mobile';
import { createOptionsMenu } from './ui/options';
import { createSplitter } from './ui/splitter';
import { createStatus } from './ui/status';
import { createTabs } from './ui/tabs';
import { applyTheme } from './ui/theme';
import type { FileDoc } from './state';
import { entryFile, fileById, kindOf, newId, persist, persistNow, session } from './state';

/** ms of typing inactivity before HTML/JS changes force a full iframe rebuild. */
const REBUILD_DEBOUNCE = 250;

const app = document.getElementById('app') as HTMLElement;
const menubarHost = document.getElementById('menubar') as HTMLElement;
const editorHost = document.getElementById('editor-host') as HTMLElement;
const tabsHost = document.getElementById('tabs') as HTMLElement;
const splitterHandle = document.getElementById('splitter') as HTMLElement;
const toPreviewButton = document.getElementById('to-preview') as HTMLElement;
const toEditorButton = document.getElementById('to-editor') as HTMLElement;
const iframe = document.getElementById('preview') as HTMLIFrameElement;
const statusBar = document.getElementById('status') as HTMLElement;

// Before anything renders: the inline script in index.html has already set the
// attribute, this keeps the module the single source of truth afterwards.
applyTheme(session.theme);

const onThemeChange = (mode: typeof session.theme): void => {
  session.theme = mode;
  persist();
};

createMenuBar(menubarHost, { theme: session.theme, onThemeChange });
const optionsMenu = createOptionsMenu({ theme: session.theme, onThemeChange });

const status = createStatus(statusBar);

/**
 * Documents whose text has changed but has not been stringified yet, keyed by
 * file id. Converting a CodeMirror Text to a string is O(document), so it is
 * deferred out of the keystroke path and done once per frame at most.
 */
const pending = new Map<string, Text>();

function commit(id: string): void {
  const doc = pending.get(id);
  if (!doc) return;
  pending.delete(id);
  const file = fileById(id);
  if (file) file.text = doc.toString();
}

function commitAll(): void {
  for (const id of Array.from(pending.keys())) commit(id);
}

const preview = createPreview(iframe, {
  onReady: () => status.clear(),
  onError: (error: PreviewError) => {
    const at = error.file ? ` (${error.file}${error.line ? ':' + error.line : ''}${error.line && error.column ? ':' + error.column : ''})` : '';
    status.error(error.message + at);
  },
});

// --- CSS: hot path -----------------------------------------------------------
// One frame, no debounce, no reload. The iframe keeps its scroll position,
// focus, JS state and animation timing. A stylesheet the HTML does not link
// simply does not land - same as in a browser.
let cssFrame = 0;
const dirtyCss = new Set<string>();

function scheduleCssPatch(id: string): void {
  dirtyCss.add(id);
  if (cssFrame) return;
  cssFrame = requestAnimationFrame(() => {
    cssFrame = 0;
    for (const fileId of dirtyCss) {
      commit(fileId);
      const file = fileById(fileId);
      if (file) preview.patchCss(file.name, file.text);
    }
    dirtyCss.clear();
    persist();
  });
}

// --- HTML / JS / file list: cold path ----------------------------------------
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
    dirtyCss.clear();
  }
  commitAll();
  status.clear('Running...');
  preview.rebuild(entryFile(), session.files);
  persist();
}

// --- files -------------------------------------------------------------------

const editor = createEditor(editorHost, {
  initial: fileById(session.activeId) ?? session.files[0]!,
  onDocChanged: (id, doc) => {
    pending.set(id, doc);
    if (fileById(id)?.kind === 'css') scheduleCssPatch(id);
    else scheduleRebuild();
  },
});

const tabs = createTabs(tabsHost, {
  onSelect: (id) => selectFile(id),
  onRename: (id) => renameFile(id),
  onCreate: () => createFile(),
  onOptions: () => optionsMenu.toggle(),
});

function paintTabs(): void {
  tabs.render(session.files, session.activeId);
}

function selectFile(id: string): void {
  const file = fileById(id);
  if (!file) return;
  commitAll();
  session.activeId = id;
  editor.show(file);
  paintTabs();
  persist();
}

/** Same rules as a filesystem plus the one the preview needs: a usable extension. */
function validateName(name: string, exclude?: string): string | null {
  if (!name) return 'Give the file a name.';
  if (/[\\/]/.test(name)) return 'No folders yet - leave out the slash.';
  if (!kindOf(name)) return 'End the name in .html, .css or .js.';
  const taken = session.files.some(
    (file) => file.id !== exclude && file.name.toLowerCase() === name.toLowerCase(),
  );
  return taken ? 'A file with that name is already open.' : null;
}

function createFile(): void {
  openFileDialog({
    title: 'New file',
    value: 'page.html',
    confirmLabel: 'Create',
    validate: (name) => validateName(name),
    onSubmit: (name) => {
      commitAll();
      const file: FileDoc = { id: newId(), name, kind: kindOf(name)!, text: '' };
      session.files.push(file);
      session.activeId = file.id;
      editor.show(file);
      paintTabs();
      rebuildNow();
    },
  });
}

function renameFile(id: string): void {
  const file = fileById(id);
  if (!file) return;
  openFileDialog({
    title: 'Rename file',
    value: file.name,
    confirmLabel: 'Rename',
    validate: (name) => validateName(name, id),
    onSubmit: (name) => {
      commitAll();
      file.name = name;
      file.kind = kindOf(name)!;
      // The extension may have changed the language, so hand the file back.
      editor.show(file);
      paintTabs();
      rebuildNow();
    },
    // Creating files without being able to remove them would be a one-way door.
    onDelete:
      session.files.length > 1
        ? () => {
            commitAll();
            const index = session.files.findIndex((entry) => entry.id === id);
            session.files.splice(index, 1);
            editor.forget(id);
            if (session.activeId === id) {
              const next = session.files[Math.min(index, session.files.length - 1)]!;
              session.activeId = next.id;
              editor.show(next);
            }
            paintTabs();
            rebuildNow();
          }
        : undefined,
  });
}

paintTabs();

// --- layout ------------------------------------------------------------------
// Desktop keeps the top bar and a resizable split; mobile is one pane at a time.
// Only one controller is attached at a time.
const narrow = window.matchMedia(MOBILE_QUERY);
let detachLayout: (() => void) | null = null;

function applyLayout(): void {
  detachLayout?.();
  detachLayout = narrow.matches
    ? createMobilePanes(app, { toPreview: toPreviewButton, toEditor: toEditorButton })
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
