/** Copy, and say so. Silent on failure rather than claiming success. */
import { showToast } from './toast';

/** Enough of the copied text to recognise it, not enough to fill the screen. */
const PREVIEW = 28;

export function copyText(text: string): void {
  if (!text) return;
  void navigator.clipboard?.writeText(text).then(
    () => showToast(`Copied  ${text.length > PREVIEW ? `${text.slice(0, PREVIEW)}...` : text}`),
    () => {
      // Clipboard denied or unavailable.
    },
  );
}
