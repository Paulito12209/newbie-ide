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
 */
import { Decoration, EditorView, ViewPlugin, WidgetType } from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { MOBILE_QUERY } from '../ui/mobile';

const PAIRS: Record<string, string> = { '<': '>', '{': '}', '(': ')', '[': ']' };
const QUOTES = new Set(['"', "'", '`']);
/** More than a few and the line is broken in a way a chip will not fix. */
const MAX_SHOWN = 3;
/** Past this the file is too big to rescan on every keystroke, and a beginner project is not. */
const MAX_SCAN = 20000;

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

class CloserGhosts extends WidgetType {
  constructor(readonly chars: string) {
    super();
  }

  override eq(other: CloserGhosts): boolean {
    return other.chars === this.chars;
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('span');
    wrap.className = 'cm-closers';
    for (const char of this.chars) {
      const chip = document.createElement('span');
      chip.className = 'cm-closer';
      chip.textContent = char;
      chip.dataset.char = char;
      chip.setAttribute('role', 'button');
      chip.setAttribute('aria-label', `Insert ${char}`);
      wrap.append(chip);
    }
    return wrap;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

function build(view: EditorView): DecorationSet {
  if (!window.matchMedia(MOBILE_QUERY).matches) return Decoration.none;
  const head = view.state.selection.main.head;
  if (head > MAX_SCAN) return Decoration.none;
  const line = view.state.doc.lineAt(head);
  const owed = missingClosers(view.state.sliceDoc(0, head));
  if (owed.length === 0) return Decoration.none;
  return Decoration.set([
    Decoration.widget({ widget: new CloserGhosts(owed.join('')), side: 1 }).range(line.to),
  ]);
}

const press = EditorView.domEventHandlers({
  click(event, view) {
    const target = (event.target as HTMLElement | null)?.closest?.('.cm-closer');
    if (!(target instanceof HTMLElement)) return false;
    const char = target.dataset.char;
    if (!char || view.composing) return false;
    // At the caret, which is where the character was missing from.
    const at = view.state.selection.main.head;
    view.dispatch({
      changes: { from: at, insert: char },
      selection: { anchor: at + char.length },
      scrollIntoView: true,
      userEvent: 'input.type',
    });
    return true;
  },
});

export function missingCloserChips(): Extension {
  return [
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
          this.decorations = build(view);
        }

        update(update: ViewUpdate): void {
          if (update.docChanged || update.selectionSet || update.viewportChanged) {
            this.decorations = build(update.view);
          }
        }
      },
      { decorations: (plugin) => plugin.decorations },
    ),
    press,
  ];
}
