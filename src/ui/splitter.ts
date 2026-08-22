/**
 * Drag-to-resize splitter. Pointer events with pointer capture, so a fast drag
 * that leaves the 5px handle (or crosses the iframe) keeps tracking.
 */
export interface SplitterOptions {
  /** Percentage of the container width taken by the left pane. */
  initial: number;
  min?: number;
  max?: number;
  onChange: (percent: number) => void;
}

export function createSplitter(
  container: HTMLElement,
  handle: HTMLElement,
  options: SplitterOptions,
): () => void {
  const min = options.min ?? 15;
  const max = options.max ?? 85;
  let frame = 0;
  let queued = options.initial;
  let pointer = -1;

  function apply(percent: number): void {
    // Rounded: sub-pixel precision here only bloats what gets persisted.
    queued = Math.round(Math.min(max, Math.max(min, percent)) * 100) / 100;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      container.style.setProperty('--split', queued + '%');
      options.onChange(queued);
    });
  }

  apply(options.initial);

  function onPointerMove(event: PointerEvent): void {
    if (event.pointerId !== pointer) return;
    const rect = container.getBoundingClientRect();
    apply(((event.clientX - rect.left) / rect.width) * 100);
  }

  function endDrag(event: PointerEvent): void {
    if (event.pointerId !== pointer) return;
    pointer = -1;
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', endDrag);
    container.dataset.dragging = 'false';
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.button !== 0 || pointer !== -1) return;
    event.preventDefault();
    pointer = event.pointerId;

    // Capture keeps tracking when the pointer outruns the 5px handle. It is an
    // enhancement: the listeners are on the window, so a pointer the browser
    // refuses to capture still drags.
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      /* no capture available for this pointer */
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    container.dataset.dragging = 'true';
  }

  function onKeyDown(event: KeyboardEvent): void {
    const delta = event.key === 'ArrowRight' ? 2 : event.key === 'ArrowLeft' ? -2 : 0;
    if (!delta) return;
    event.preventDefault();
    apply(queued + delta);
  }

  handle.setAttribute('aria-label', 'Resize editor and preview');
  handle.addEventListener('pointerdown', onPointerDown);
  handle.addEventListener('keydown', onKeyDown);

  return () => {
    // Detaching mid-drag (a layout switch) must not leave window listeners behind.
    pointer = -1;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', endDrag);
    container.dataset.dragging = 'false';
    handle.removeEventListener('pointerdown', onPointerDown);
    handle.removeEventListener('keydown', onKeyDown);
    if (frame) cancelAnimationFrame(frame);
  };
}
