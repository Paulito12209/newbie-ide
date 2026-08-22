/**
 * Mobile layout: two full-width panes on a sliding track.
 *
 * One pane fills the screen. A single floating button above the file bar moves
 * between them, showing the icon of where it will take you: a monitor while you
 * are in the code, angle brackets once you are looking at the page.
 *
 * Nothing here resizes anything. The desktop splitter still owns that.
 */
import { ICON_CODE, ICON_DISPLAY } from './icons';

/** Keep in sync with the mobile media query in styles.css. */
export const MOBILE_QUERY = '(max-width: 767px)';

export type PaneView = 'editor' | 'preview';

export interface MobilePanesOptions {
  fab: HTMLElement;
  initial?: PaneView;
}

export function createMobilePanes(container: HTMLElement, options: MobilePanesOptions): () => void {
  const { fab } = options;
  let view: PaneView = options.initial ?? 'editor';

  function show(next: PaneView): void {
    view = next;
    container.dataset.mobileView = next;
    const goingToPreview = next === 'editor';
    fab.innerHTML = goingToPreview ? ICON_DISPLAY : ICON_CODE;
    fab.setAttribute('aria-label', goingToPreview ? 'Show preview' : 'Show code');
  }

  const toggle = (): void => show(view === 'editor' ? 'preview' : 'editor');

  fab.addEventListener('click', toggle);
  show(view);

  return () => {
    fab.removeEventListener('click', toggle);
    delete container.dataset.mobileView;
  };
}
