/**
 * Keyboard-aware sizing.
 *
 * On a phone the on-screen keyboard covers the bottom of the page without the
 * layout knowing about it, so the line you are typing on ends up underneath it.
 * visualViewport reports the part that is actually visible; the shell is sized
 * to that, which lets everything below - CodeMirror's own scrolling included -
 * work with a viewport that tells the truth.
 */
const MIN_KEYBOARD = 120;

/** How much of the viewport the keyboard is covering, in px. */
function inset(): number {
  const vv = window.visualViewport;
  if (!vv) return 0;
  // A pinch-zoom also shrinks the visual viewport; that is not a keyboard.
  if (vv.scale > 1.01) return 0;
  const hidden = window.innerHeight - vv.height - vv.offsetTop;
  return hidden > MIN_KEYBOARD ? Math.round(hidden) : 0;
}

export function trackKeyboard(): () => void {
  const root = document.documentElement;
  let frame = 0;

  function apply(): void {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const px = inset();
      root.style.setProperty('--kb-inset', `${px}px`);
      if (px > 0) root.dataset.keyboard = 'open';
      else delete root.dataset.keyboard;
    });
  }

  const vv = window.visualViewport;
  vv?.addEventListener('resize', apply);
  vv?.addEventListener('scroll', apply);
  window.addEventListener('orientationchange', apply);
  apply();

  return () => {
    vv?.removeEventListener('resize', apply);
    vv?.removeEventListener('scroll', apply);
    window.removeEventListener('orientationchange', apply);
    if (frame) cancelAnimationFrame(frame);
    root.style.removeProperty('--kb-inset');
    delete root.dataset.keyboard;
  };
}
