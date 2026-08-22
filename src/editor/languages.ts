/**
 * Language modes.
 *
 * Only HTML is in the initial chunk — it is the tab that renders on cold load.
 * CSS and JS grammars are separate chunks fetched on first use, and prefetched
 * at idle so the first tab switch is already warm.
 */
import type { Extension } from '@codemirror/state';
import type { LangId } from '../state';
import { extension as htmlMode } from './lang/html';

const cache = new Map<LangId, Extension>([['html', htmlMode]]);

const loaders: Record<Exclude<LangId, 'html'>, () => Promise<{ extension: Extension }>> = {
  css: () => import('./lang/css'),
  js: () => import('./lang/js'),
};

/** Synchronous mode, if it has already been loaded. */
export function peekLanguage(lang: LangId): Extension | null {
  return cache.get(lang) ?? null;
}

export async function loadLanguage(lang: LangId): Promise<Extension> {
  const cached = cache.get(lang);
  if (cached) return cached;
  const mod = await loaders[lang as Exclude<LangId, 'html'>]();
  cache.set(lang, mod.extension);
  return mod.extension;
}

/**
 * Warm the other grammars so tab switches never block.
 * Sequenced behind the load event and then an idle callback: the first paint
 * owes nothing to CSS or JS highlighting and must not compete with it for
 * bandwidth or main-thread time.
 */
export function prefetchLanguages(): void {
  const whenIdle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1200));
  const warm = () =>
    whenIdle(() => {
      void loadLanguage('css');
      void loadLanguage('js');
    });

  if (document.readyState === 'complete') warm();
  else window.addEventListener('load', warm, { once: true });
}
