/**
 * Mobile layout: two full-width panes on a sliding track.
 *
 * The editor gets the whole viewport except a 24px strip on the right, where
 * the edge of the live preview stays visible. That strip is also the control:
 * tap it to switch panes, or drag/swipe it across. Sliding to the preview
 * leaves the same 24px of the editor peeking on the left, so the way back is
 * always in reach.
 *
 * Nothing here resizes anything - the desktop splitter still owns that. This is
 * a different interaction for a different form factor, not a variant of it.
 */

/** Keep in sync with the mobile media query in styles.css. */
export const MOBILE_QUERY = '(max-width: 767px)';

export type PaneView = 'editor' | 'preview';

export interface MobilePanesOptions {
  initial?: PaneView;
  onChange?: (view: PaneView) => void;
}

/**
 * Below this much movement the gesture is a tap, however long it lasted. There
 * is no long-press gesture competing for this strip, and a deliberate press
 * that snapped back to the same pane would just look broken.
 */
const TAP_SLOP = 8;
/** px per ms: a flick this fast decides the direction regardless of distance. */
const FLICK_VELOCITY = 0.4;

export function createMobilePanes(
  container: HTMLElement,
  handle: HTMLElement,
  options: MobilePanesOptions = {},
): () => void {
  let view: PaneView = options.initial ?? 'editor';
  let frame = 0;
  let pending = 0;

  const peek = (): number =>
    parseFloat(getComputedStyle(container).getPropertyValue('--peek')) || 24;

  /** Track offset that puts the given pane on screen. */
  const offsetFor = (target: PaneView): number =>
    target === 'editor' ? 0 : 2 * peek() - container.clientWidth;

  function setSlide(px: number): void {
    pending = px;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      container.style.setProperty('--slide', `${pending}px`);
    });
  }

  function show(next: PaneView): void {
    view = next;
    container.dataset.mobileView = next;
    handle.setAttribute(
      'aria-label',
      next === 'editor' ? 'Show preview' : 'Show editor',
    );
    setSlide(offsetFor(next));
    options.onChange?.(next);
  }

  // --- gesture ---------------------------------------------------------------

  let pointer = -1;
  let startX = 0;
  let base = 0;
  let startedAt = 0;
  let travelled = 0;

  const dragging = (): boolean => pointer !== -1;

  function onPointerMove(event: PointerEvent): void {
    if (event.pointerId !== pointer) return;
    const dx = event.clientX - startX;
    travelled = Math.max(travelled, Math.abs(dx));
    const min = offsetFor('preview');
    setSlide(Math.min(0, Math.max(min, base + dx)));
  }

  /**
   * A gesture can end four ways: pointerup, pointercancel, the browser taking
   * the capture away, or the pointer never being captured at all. All of them
   * have to release the track, or it would stay stranded mid-slide.
   */
  function stopTracking(): void {
    const id = pointer;
    pointer = -1;
    if (id !== -1 && handle.hasPointerCapture(id)) handle.releasePointerCapture(id);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', cancelDrag);
    handle.removeEventListener('lostpointercapture', cancelDrag);
    container.dataset.dragging = 'false';
  }

  function endDrag(event: PointerEvent): void {
    if (event.pointerId !== pointer) return;
    const dx = event.clientX - startX;
    const elapsed = performance.now() - startedAt;
    stopTracking();

    // A tap toggles; a drag lands wherever it was headed.
    if (travelled < TAP_SLOP) {
      show(view === 'editor' ? 'preview' : 'editor');
      return;
    }

    const velocity = dx / Math.max(elapsed, 1);
    if (Math.abs(velocity) > FLICK_VELOCITY) {
      show(velocity < 0 ? 'preview' : 'editor');
      return;
    }

    const min = offsetFor('preview');
    const current = Math.min(0, Math.max(min, base + dx));
    show(current < min / 2 ? 'preview' : 'editor');
  }

  /** Interrupted gesture: settle back on whichever pane we started from. */
  function cancelDrag(event: PointerEvent): void {
    if (event.pointerId !== pointer) return;
    stopTracking();
    show(view);
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.button !== 0 || dragging()) return;
    // No preventDefault here: `touch-action: none` on the strip already stops
    // touch scrolling, and dragging sets user-select: none. Cancelling the
    // pointer event would also cancel the click that follows a tap, which
    // costs compatibility for nothing.
    pointer = event.pointerId;
    startX = event.clientX;
    base = offsetFor(view);
    startedAt = performance.now();
    travelled = 0;

    // Capture keeps a fast drag tracking after the finger leaves the strip.
    // It is an optimisation: the listeners sit on the window either way, so a
    // browser that refuses the capture still gets a working gesture.
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      /* no capture available for this pointer */
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', cancelDrag);
    handle.addEventListener('lostpointercapture', cancelDrag);
    container.dataset.dragging = 'true';
  }

  function onKeyDown(event: KeyboardEvent): void {
    // Swiping left reveals the preview, so ArrowLeft does the same thing.
    const next: PaneView | null =
      event.key === 'ArrowLeft' ? 'preview' : event.key === 'ArrowRight' ? 'editor' : null;
    const toggle = event.key === 'Enter' || event.key === ' ';
    if (!next && !toggle) return;
    event.preventDefault();
    show(next ?? (view === 'editor' ? 'preview' : 'editor'));
  }

  /** The track offset is measured in pixels, so it has to survive a rotation. */
  function onResize(): void {
    if (dragging()) return;
    setSlide(offsetFor(view));
  }

  handle.addEventListener('pointerdown', onPointerDown);
  handle.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);

  show(view);

  return () => {
    if (dragging()) stopTracking();
    handle.removeEventListener('pointerdown', onPointerDown);
    handle.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', onResize);
    if (frame) cancelAnimationFrame(frame);
    container.style.removeProperty('--slide');
    delete container.dataset.mobileView;
    handle.removeAttribute('aria-label');
  };
}
