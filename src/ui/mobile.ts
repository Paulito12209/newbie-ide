/**
 * Mobile layout: two full-width panes on a sliding track.
 *
 * One pane fills the screen; you move between them with a single floating
 * button pinned to the edge you are heading towards - Display on the right,
 * Code on the left once you are there. The earlier peeking strip and edge swipe
 * are gone: the whole right edge no longer does anything special.
 *
 * Nothing here resizes anything. The desktop splitter still owns that.
 */

/** Keep in sync with the mobile media query in styles.css. */
export const MOBILE_QUERY = '(max-width: 767px)';

export type PaneView = 'editor' | 'preview';

export interface MobilePanesOptions {
  /** Shown over the editor; moves to the preview. */
  toPreview: HTMLElement;
  /** Shown over the preview; moves back to the editor. */
  toEditor: HTMLElement;
  initial?: PaneView;
}

export function createMobilePanes(container: HTMLElement, options: MobilePanesOptions): () => void {
  let view: PaneView = options.initial ?? 'editor';

  function show(next: PaneView): void {
    view = next;
    container.dataset.mobileView = next;
  }

  const toPreview = (): void => show('preview');
  const toEditor = (): void => show('editor');

  options.toPreview.addEventListener('click', toPreview);
  options.toEditor.addEventListener('click', toEditor);

  show(view);

  return () => {
    options.toPreview.removeEventListener('click', toPreview);
    options.toEditor.removeEventListener('click', toEditor);
    delete container.dataset.mobileView;
  };
}
