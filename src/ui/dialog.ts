/**
 * The file-name dialog, used for both creating and renaming.
 *
 * A real <dialog> rather than a hand-rolled overlay: it brings the backdrop,
 * focus trapping and Escape handling with it, which is a lot of behaviour for
 * no bytes.
 */
import { closeOnBackdrop } from './dismiss';

export interface FileDialogOptions {
  title: string;
  value: string;
  confirmLabel: string;
  /** Returns an error to show, or null when the name is acceptable. */
  validate: (name: string) => string | null;
  onSubmit: (name: string) => void;
  /** Offered only where removing the file is actually allowed. */
  onDelete?: () => void;
}

export function openFileDialog(options: FileDialogOptions): void {
  const dialog = document.createElement('dialog');
  dialog.className = 'sl-dialog';

  const form = document.createElement('form');
  form.method = 'dialog';

  const header = document.createElement('div');
  header.className = 'sl-dialog-header';

  const heading = document.createElement('h2');
  heading.textContent = options.title;

  // Top right, out of the way: the two buttons at the bottom are the decisions,
  // and backing out is not one of them.
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'sl-dialog-cancel';
  cancel.textContent = 'X';
  cancel.title = 'Cancel';
  cancel.setAttribute('aria-label', 'Cancel');
  cancel.addEventListener('click', () => dialog.close());

  header.append(heading, cancel);

  const input = document.createElement('input');
  input.type = 'text';
  input.value = options.value;
  input.spellcheck = false;
  input.autocapitalize = 'off';
  input.setAttribute('aria-label', 'File name');

  const error = document.createElement('p');
  error.className = 'sl-dialog-error';
  error.setAttribute('aria-live', 'polite');

  const buttons = document.createElement('div');
  buttons.className = 'sl-dialog-buttons';

  // Deliberately quieter than the confirm: deleting is the thing you reach for
  // least, so it should not look like the obvious button.
  if (options.onDelete) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'sl-dialog-delete';
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => {
      options.onDelete?.();
      dialog.close();
    });
    buttons.append(remove);
  }

  const confirm = document.createElement('button');
  confirm.type = 'submit';
  confirm.className = 'sl-dialog-confirm';
  confirm.textContent = options.confirmLabel;

  buttons.append(confirm);
  form.append(header, input, error, buttons);
  dialog.append(form);
  document.body.append(dialog);

  form.addEventListener('submit', (event) => {
    const name = input.value.trim();
    const problem = options.validate(name);
    if (problem) {
      // Keep the dialog open and say why.
      event.preventDefault();
      error.textContent = problem;
      input.focus();
      return;
    }
    options.onSubmit(name);
  });

  input.addEventListener('input', () => {
    error.textContent = '';
  });

  closeOnBackdrop(dialog);
  dialog.addEventListener('close', () => dialog.remove());
  dialog.showModal();

  // Select the stem, not the extension: renaming is almost never about ".css".
  const dot = input.value.lastIndexOf('.');
  input.setSelectionRange(0, dot > 0 ? dot : input.value.length);
  input.focus();
}
