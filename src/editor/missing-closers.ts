/**
 * The closers you still owe the line, parked at the right edge.
 *
 * Auto-closing puts the pair in for you, but the moment you delete one half by
 * accident it is gone - and on a phone keyboard `>`, `}` and `"` are two layers
 * deep, so getting it back is a chore. This works out which closers are still
 * owed and shows them greyed out on the right. Tap one and it lands at the
 * caret.
 *
 * The scan runs from the start of the file to the caret, not just the current
 * line: a `{` is usually opened on the line above the one you are typing on,
 * which is exactly the case a per-line scan misses.
 *
 * Mobile only: on a desktop keyboard the character is one keypress away.
 *
 * The scan covers the whole file, not the text before the caret. Stopping at
 * the caret reported a `>` as missing whenever the caret sat inside a tag that
 * was perfectly closed two characters later.
 */
const PAIRS: Record<string, string> = { '<': '>', '{': '}', '(': ')', '[': ']' };
const QUOTES = new Set(['"', "'", '`']);
/** More than a few and the line is broken in a way a chip will not fix. */
const MAX_SHOWN = 3;
/** Past this the file is too big to rescan on every keystroke, and a beginner project is not. */
export const MAX_SCAN = 20000;

/**
 * Closers still owed, innermost first. Quotes swallow everything until they
 * close, same as the language does.
 */
export function missingClosers(text: string): string[] {
  const stack: string[] = [];
  let quote = '';

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (quote) {
      if (char === '\\') i += 1;
      else if (char === quote) quote = '';
      continue;
    }
    if (QUOTES.has(char)) {
      quote = char;
      continue;
    }
    if (char in PAIRS) stack.push(PAIRS[char]!);
    else if (stack.length && char === stack[stack.length - 1]) stack.pop();
  }

  const owed = stack.reverse();
  if (quote) owed.unshift(quote);
  return owed.slice(0, MAX_SHOWN);
}
