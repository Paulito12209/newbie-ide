/** The thin bar under the preview. Shows the last user-code error, or nothing bad. */
export interface Status {
  clear(message?: string): void;
  error(text: string): void;
}

export function createStatus(element: HTMLElement): Status {
  return {
    clear(message = 'No errors'): void {
      element.dataset.kind = 'ok';
      element.textContent = message;
    },
    error(text: string): void {
      element.dataset.kind = 'error';
      element.textContent = text;
    },
  };
}
