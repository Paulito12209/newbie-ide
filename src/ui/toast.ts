/** A brief message at the top of the screen. Replaces itself if one is up. */
let node: HTMLElement | null = null;
let hide = 0;

export function showToast(text: string): void {
  if (!node) {
    node = document.createElement('div');
    node.className = 'sl-toast';
    node.setAttribute('role', 'status');
    node.setAttribute('aria-live', 'polite');
    document.body.append(node);
  }

  node.textContent = text;
  node.dataset.visible = 'true';
  clearTimeout(hide);
  hide = window.setTimeout(() => {
    if (node) delete node.dataset.visible;
  }, 1600);
}
