/**
 * Tap-outside-to-close for a modal <dialog>.
 *
 * showModal() gives you Escape and nothing else. On a phone there is no Escape
 * key, so without this a drawer is a trap. The click lands on the dialog
 * element itself when it hits the backdrop, but comparing against the box is
 * unambiguous and also covers the padding case.
 */
export function closeOnBackdrop(dialog: HTMLDialogElement): void {
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    const inside =
      event.clientX >= box.left &&
      event.clientX <= box.right &&
      event.clientY >= box.top &&
      event.clientY <= box.bottom;
    if (!inside) dialog.close();
  });
}
