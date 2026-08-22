/**
 * Minimal auto-closing brackets.
 *
 * CodeMirror ships `closeBrackets` inside `@codemirror/autocomplete`, and that
 * package is deliberately absent from this project — beginners get no
 * completion, ever, not even as a transitive dependency. This is the small
 * subset we actually want, in ~80 lines.
 */
import { EditorView, keymap } from '@codemirror/view';
import { EditorSelection, Prec } from '@codemirror/state';
import type { Extension } from '@codemirror/state';

const PAIRS: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
const QUOTES = new Set(['"', "'", '`']);
const CLOSERS = new Set(Object.values(PAIRS));

const isWordChar = (ch: string) => /[\w$]/.test(ch);
/** Auto-closing before text would strand the closer inside an expression. */
const closeableBefore = (ch: string) => ch === '' || /[\s)\]}>,;:.]/.test(ch);

function charAt(doc: { sliceString(from: number, to: number): string }, pos: number, offset: number): string {
  return doc.sliceString(pos + offset, pos + offset + 1);
}

const handleInput = EditorView.inputHandler.of((view, from, to, text) => {
  // Ignore IME composition and pastes; only single typed characters open pairs.
  if (text.length !== 1 || view.state.readOnly) return false;
  const isOpener = text in PAIRS;
  const isQuote = QUOTES.has(text);
  const isCloser = CLOSERS.has(text);
  if (!isOpener && !isQuote && !isCloser) return false;

  const { state } = view;
  let handled = false;

  const tr = state.changeByRange((range) => {
    // A stale range (multi-cursor edge case) falls through to default handling.
    if (range.from !== from || range.to !== to) {
      if (state.selection.ranges.length === 1) return { range };
    }

    const next = charAt(state.doc, range.to, 0);
    const prev = charAt(state.doc, range.from, -1);

    // Type over an existing closer instead of doubling it.
    if ((isCloser || isQuote) && range.empty && next === text) {
      handled = true;
      return { range: EditorSelection.cursor(range.to + 1) };
    }

    if (isCloser) return { range };

    const close = isOpener ? PAIRS[text]! : text;

    // Wrap a selection in the pair.
    if (!range.empty) {
      handled = true;
      return {
        changes: [
          { from: range.from, insert: text },
          { from: range.to, insert: close },
        ],
        range: EditorSelection.range(range.from + 1, range.to + 1),
      };
    }

    // `don't` must not become `don''t`, and `foo(bar` must not gain a stray `)`.
    if (isQuote && (isWordChar(prev) || prev === text)) return { range };
    if (!closeableBefore(next)) return { range };

    handled = true;
    return {
      changes: { from: range.from, insert: text + close },
      range: EditorSelection.cursor(range.from + 1),
    };
  });

  if (!handled) return false;
  view.dispatch(state.update(tr, { scrollIntoView: true, userEvent: 'input.type' }));
  return true;
});

/**
 * Backspace between an empty pair removes both halves.
 *
 * Bound to the physical key, like upstream CodeMirror: deletions that arrive as
 * `beforeinput`/deleteContentBackward without a keydown (soft keyboards, some
 * IMEs) fall through to a plain single-character delete.
 */
const deletePair = keymap.of([
  {
    key: 'Backspace',
    run: (view) => {
      const { state } = view;
      let handled = false;
      const tr = state.changeByRange((range) => {
        if (!range.empty) return { range };
        const prev = charAt(state.doc, range.from, -1);
        const next = charAt(state.doc, range.from, 0);
        const matches = (prev in PAIRS && PAIRS[prev] === next) || (QUOTES.has(prev) && prev === next);
        if (!matches) return { range };
        handled = true;
        return {
          changes: { from: range.from - 1, to: range.from + 1 },
          range: EditorSelection.cursor(range.from - 1),
        };
      });
      if (!handled) return false;
      view.dispatch(state.update(tr, { scrollIntoView: true, userEvent: 'delete.backward' }));
      return true;
    },
  },
]);

export function closeBrackets(): Extension {
  return [handleInput, Prec.high(deletePair)];
}
