/**
 * Plain module-scope state. No store library, no reactivity system.
 * Everything that survives a reload lives here and is mirrored to localStorage.
 */

/** What a file is, derived from its extension. */
export type LangId = 'html' | 'css' | 'js';

/** 'system' follows prefers-color-scheme; the others override it. */
export type ThemeMode = 'system' | 'light' | 'dark';

const THEMES: readonly ThemeMode[] = ['system', 'light', 'dark'];

export interface FileDoc {
  /** Stable across renames, which is what tabs and editor states key on. */
  id: string;
  name: string;
  kind: LangId;
  text: string;
}

/**
 * What the editor is allowed to reach for. Everything starts locked: the point
 * is to grow the language you work in on purpose, not to be handed all of it at
 * once. Each rule changes what the tool actually writes, never just a label.
 */
export interface Rules {
  /** Off: layout templates write flexbox. On: they write CSS grid. */
  grid: boolean;
  /** Off: examples use button.onclick. */
  addEventListener: boolean;
}

export const DEFAULT_RULES: Rules = { grid: false, addEventListener: false };

export interface Session {
  files: FileDoc[];
  rules: Rules;
  activeId: string;
  /** Editor pane width as a percentage of the window. Desktop only. */
  split: number;
  theme: ThemeMode;
}

const STORAGE_KEY = 'slashlearn.session.v2';
const LEGACY_KEY = 'slashlearn.session.v1';

const EXTENSIONS: Record<string, LangId> = {
  html: 'html',
  htm: 'html',
  css: 'css',
  js: 'js',
  mjs: 'js',
};

/** Null for an extension the preview cannot do anything with. */
export function kindOf(name: string): LangId | null {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return null;
  return EXTENSIONS[name.slice(dot + 1).toLowerCase()] ?? null;
}

let idCounter = 0;
export function newId(): string {
  idCounter += 1;
  return `f${Date.now().toString(36)}${idCounter}`;
}

const DEFAULT_HTML = [
  '<!DOCTYPE html>',
  '<html lang="en">',
  '  <head>',
  '    <meta charset="utf-8">',
  '    <title>My page</title>',
  '    <link rel="stylesheet" href="style.css">',
  '  </head>',
  '  <body>',
  '    <h1 id="title">Hello</h1>',
  '    <p>Edit style.css and watch this update instantly.</p>',
  '    <button id="go">Click me</button>',
  '',
  '    <script src="script.js"></script>',
  '  </body>',
  '</html>',
  '',
].join('\n');

const DEFAULT_CSS = [
  'body {',
  '  font-family: system-ui, sans-serif;',
  '  margin: 24px;',
  '}',
  '',
  '#title {',
  '  color: #333;',
  '}',
  '',
].join('\n');

/**
 * Written the way a beginner is taught first: getElementById and onclick, plain
 * function, plain string joining. No addEventListener, no arrow function and no
 * template literal - backticks are also a nuisance on a phone keyboard.
 */
const DEFAULT_JS = [
  "const button = document.getElementById('go');",
  'let count = 0;',
  '',
  'button.onclick = function () {',
  '  count = count + 1;',
  "  button.textContent = 'Clicked ' + count;",
  '};',
  '',
].join('\n');

function starterFiles(html = DEFAULT_HTML, css = DEFAULT_CSS, js = DEFAULT_JS): FileDoc[] {
  return [
    { id: newId(), name: 'index.html', kind: 'html', text: html },
    { id: newId(), name: 'style.css', kind: 'css', text: css },
    { id: newId(), name: 'script.js', kind: 'js', text: js },
  ];
}

function defaults(): Session {
  const files = starterFiles();
  return { files, activeId: files[0]!.id, split: 50, theme: 'system', rules: { ...DEFAULT_RULES } };
}

/**
 * v1 stored exactly three documents and wired the CSS and JS into the preview
 * behind the user's back. v2 stores a file list and links nothing implicitly, so
 * an old session is migrated into a document that carries the tags it was
 * previously getting for free - otherwise the work would silently stop
 * rendering.
 */
function migrateLegacy(): Session | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const old = JSON.parse(raw) as { html?: string; css?: string; js?: string; theme?: ThemeMode; split?: number };
    if (typeof old.html !== 'string') return null;

    const body = old.html.trim();
    const html = [
      '<!DOCTYPE html>',
      '<html lang="en">',
      '  <head>',
      '    <meta charset="utf-8">',
      '    <link rel="stylesheet" href="style.css">',
      '  </head>',
      '  <body>',
      body,
      '',
      '    <script src="script.js"></script>',
      '  </body>',
      '</html>',
      '',
    ].join('\n');

    const files = starterFiles(html, old.css ?? DEFAULT_CSS, old.js ?? DEFAULT_JS);
    return {
      files,
      activeId: files[0]!.id,
      split: typeof old.split === 'number' && old.split > 0 ? old.split : 50,
      theme: THEMES.includes(old.theme as ThemeMode) ? (old.theme as ThemeMode) : 'system',
      rules: { ...DEFAULT_RULES },
    };
  } catch {
    return null;
  }
}

function readFiles(value: unknown): FileDoc[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const files: FileDoc[] = [];
  for (const entry of value as Partial<FileDoc>[]) {
    if (typeof entry?.name !== 'string' || typeof entry.text !== 'string') return null;
    const kind = kindOf(entry.name);
    if (!kind) return null;
    files.push({ id: typeof entry.id === 'string' ? entry.id : newId(), name: entry.name, kind, text: entry.text });
  }
  return files;
}

function read(): Session {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return migrateLegacy() ?? defaults();
    const parsed = JSON.parse(raw) as Partial<Session>;
    const files = readFiles(parsed.files);
    if (!files) return defaults();
    const active = files.some((file) => file.id === parsed.activeId) ? parsed.activeId! : files[0]!.id;
    return {
      files,
      activeId: active,
      split: typeof parsed.split === 'number' && parsed.split > 0 ? parsed.split : 50,
      theme: THEMES.includes(parsed.theme as ThemeMode) ? (parsed.theme as ThemeMode) : 'system',
      rules: { ...DEFAULT_RULES, ...(parsed.rules ?? {}) },
    };
  } catch {
    // Corrupt or unavailable storage must never stop the editor from booting.
    return defaults();
  }
}

export const session: Session = read();

export function fileById(id: string): FileDoc | undefined {
  return session.files.find((file) => file.id === id);
}

/** The page the preview renders: index.html if there is one, else the first HTML file. */
export function entryFile(): FileDoc | undefined {
  return (
    session.files.find((file) => file.kind === 'html' && file.name.toLowerCase() === 'index.html') ??
    session.files.find((file) => file.kind === 'html')
  );
}

let saveHandle = 0;

function write(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Quota or private-mode failure: the session simply is not restored.
  }
}

/**
 * Persist off the typing path. Writing to localStorage is synchronous and can
 * take milliseconds on large docs, so it is deferred to idle time.
 */
export function persist(): void {
  if (saveHandle) return;
  const schedule = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 500));
  saveHandle = schedule(() => {
    saveHandle = 0;
    write();
  }) as unknown as number;
}

/** Save synchronously. Only for pagehide, where idle callbacks never run. */
export function persistNow(): void {
  write();
}
