/**
 * Plain module-scope state. No store library, no reactivity system.
 * Everything that survives a reload lives here and is mirrored to localStorage.
 */

export type LangId = 'html' | 'css' | 'js';

/** 'system' follows prefers-color-scheme; the others override it. */
export type ThemeMode = 'system' | 'light' | 'dark';

const THEMES: readonly ThemeMode[] = ['system', 'light', 'dark'];

export const LANGS: readonly LangId[] = ['html', 'css', 'js'];

export interface Session {
  html: string;
  css: string;
  js: string;
  active: LangId;
  /** Editor pane width as a percentage of the window. */
  split: number;
  theme: ThemeMode;
}

const STORAGE_KEY = 'slashlearn.session.v1';

const DEFAULT_SESSION: Session = {
  html: [
    '<h1 id="title">Hello</h1>',
    '<p>Edit the CSS tab and watch this update instantly.</p>',
    '<button id="go">Click me</button>',
    '',
  ].join('\n'),
  css: [
    'body {',
    '  font-family: system-ui, sans-serif;',
    '  margin: 24px;',
    '}',
    '',
    '#title {',
    '  color: #333;',
    '}',
    '',
  ].join('\n'),
  js: [
    "const button = document.getElementById('go');",
    'let count = 0;',
    '',
    "button.addEventListener('click', () => {",
    '  count += 1;',
    '  button.textContent = `Clicked ${count}`;',
    '});',
    '',
  ].join('\n'),
  active: 'html',
  split: 50,
  theme: 'system',
};

function read(): Session {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SESSION };
    const parsed = JSON.parse(raw) as Partial<Session>;
    return {
      html: typeof parsed.html === 'string' ? parsed.html : DEFAULT_SESSION.html,
      css: typeof parsed.css === 'string' ? parsed.css : DEFAULT_SESSION.css,
      js: typeof parsed.js === 'string' ? parsed.js : DEFAULT_SESSION.js,
      active: LANGS.includes(parsed.active as LangId) ? (parsed.active as LangId) : 'html',
      split: typeof parsed.split === 'number' && parsed.split > 0 ? parsed.split : DEFAULT_SESSION.split,
      theme: THEMES.includes(parsed.theme as ThemeMode) ? (parsed.theme as ThemeMode) : 'system',
    };
  } catch {
    // Corrupt or unavailable storage must never stop the editor from booting.
    return { ...DEFAULT_SESSION };
  }
}

export const session: Session = read();

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
