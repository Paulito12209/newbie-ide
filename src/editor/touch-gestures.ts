/**
 * Touch gestures, on mobile only.
 *
 * A double tap selects the word or value under your finger, so the next
 * keystroke replaces it. Single tap is left alone: it is also how you place the
 * caret.
 *
 * Line-level actions live in the menu at the end of the line, not in a gesture -
 * see line-menu.ts. A gesture you have to discover is worse than a button you
 * can see.
 */
import { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import { MOBILE_QUERY } from '../ui/mobile';

const DOUBLE_TAP_MS = 320;

export function touchGestures(): Extension {
  let lastTap = 0;
  let lastPos = -1;

  return EditorView.domEventHandlers({
    pointerup(event, view) {
      if (!window.matchMedia(MOBILE_QUERY).matches) return false;
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos == null) return false;

      const word = view.state.wordAt(pos);
      const now = performance.now();

      // Second tap on the same word.
      if (now - lastTap < DOUBLE_TAP_MS && word && lastPos >= word.from && lastPos <= word.to) {
        lastTap = 0;
        view.dispatch({ selection: EditorSelection.range(word.from, word.to) });
        return false;
      }

      lastTap = now;
      lastPos = pos;
      // Never consumed: the tap still moves the caret.
      return false;
    },
  });
}
