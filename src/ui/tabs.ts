/** File tabs. A tablist of three buttons; no state of its own beyond selection. */
import type { LangId } from '../state';
import { LANGS } from '../state';

const LABELS: Record<LangId, string> = { html: 'index.html', css: 'style.css', js: 'script.js' };

export interface Tabs {
  select(lang: LangId): void;
}

export function createTabs(
  host: HTMLElement,
  active: LangId,
  onSelect: (lang: LangId) => void,
): Tabs {
  const buttons = new Map<LangId, HTMLButtonElement>();

  function paint(lang: LangId): void {
    for (const [id, button] of buttons) {
      const selected = id === lang;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    }
  }

  function select(lang: LangId): void {
    paint(lang);
    onSelect(lang);
  }

  for (const lang of LANGS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.role = 'tab';
    button.textContent = LABELS[lang];
    button.addEventListener('click', () => select(lang));
    button.addEventListener('keydown', (event) => {
      const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (!delta) return;
      event.preventDefault();
      const next = LANGS[(LANGS.indexOf(lang) + delta + LANGS.length) % LANGS.length]!;
      buttons.get(next)?.focus();
      select(next);
    });
    buttons.set(lang, button);
    host.append(button);
  }

  paint(active);
  return { select };
}
