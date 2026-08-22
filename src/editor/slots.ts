/**
 * Editable slots: tappable targets at the places you actually type into.
 *
 * On a phone, landing the caret between `""` or between `>` and `</` is
 * genuinely hard - the gap is a couple of pixels wide. This marks those spots
 * and gives each one a hit area far larger than what it draws:
 *
 *   - an **empty** slot becomes a small chip you can hit, and tapping it puts
 *     the caret inside;
 *   - a **filled** slot gets a quiet pill around the value, and tapping it
 *     selects the whole value so the next keystroke replaces it. That is the
 *     "I want to change it afterwards" case, which precision-tapping never
 *     solved.
 *
 * Positions come from the syntax tree, so a slot is only ever offered where the
 * language really has one - never inside a comment or a string that happens to
 * look like markup.
 */
import { Decoration, EditorView, ViewPlugin, WidgetType } from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';
import { EditorSelection, RangeSetBuilder } from '@codemirror/state';
import type { EditorState, Extension, Range } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type { SyntaxNode } from '@lezer/common';
import type { LangId } from '../state';

interface Slot {
  from: number;
  to: number;
}

const WHITESPACE = /^\s*$/;

/** Their content is another language, not a value to fill in. */
const OPAQUE_ELEMENTS = new Set(['script', 'style']);

/** Trims a range down to its non-whitespace core. */
function trim(state: EditorState, from: number, to: number): Slot {
  const text = state.doc.sliceString(from, to);
  const lead = text.length - text.trimStart().length;
  const trail = text.length - text.trimEnd().length;
  return from + lead <= to - trail ? { from: from + lead, to: to - trail } : { from, to: from };
}

/** Inside the quotes, when there are quotes. */
function insideQuotes(state: EditorState, from: number, to: number): Slot {
  const text = state.doc.sliceString(from, to);
  const quoted = text.length >= 2 && (text[0] === '"' || text[0] === "'") && text[text.length - 1] === text[0];
  return quoted ? { from: from + 1, to: to - 1 } : { from, to };
}

function htmlSlots(state: EditorState, from: number, to: number, into: Slot[]): void {
  syntaxTree(state).iterate({
    from,
    to,
    enter: (node) => {
      if (node.name === 'AttributeValue') {
        into.push(insideQuotes(state, node.from, node.to));
        return;
      }
      if (node.name !== 'Element') return;

      const open = node.node.firstChild;
      const close = node.node.lastChild;
      // A self-closing tag is its own first and last child, and has no content.
      if (!open || !close || open.name !== 'OpenTag' || close.name !== 'CloseTag') return;
      if (open.to > close.from) return;

      const tag = open.getChild('TagName');
      if (tag && OPAQUE_ELEMENTS.has(state.doc.sliceString(tag.from, tag.to).toLowerCase())) return;

      // Only text belongs in a slot. An element holding other elements is
      // structure, and marking it would be noise. Compare by position, not by
      // identity: Lezer hands out a fresh node object on every access, so
      // `child !== close` would never be false.
      for (let child: SyntaxNode | null = open.nextSibling; child && child.from < close.from; child = child.nextSibling) {
        if (child.name !== 'Text') return;
      }

      const content = state.doc.sliceString(open.to, close.from);
      if (content === '') into.push({ from: open.to, to: open.to });
      // Whitespace across lines is formatting, not an empty value.
      else if (!WHITESPACE.test(content)) into.push(trim(state, open.to, close.from));
    },
  });
}

function cssSlots(state: EditorState, from: number, to: number, into: Slot[]): void {
  syntaxTree(state).iterate({
    from,
    to,
    enter: (node) => {
      if (node.name !== 'Declaration') return;
      let colon: SyntaxNode | null = null;
      for (let child = node.node.firstChild; child; child = child.nextSibling) {
        if (child.name === ':') {
          colon = child;
          break;
        }
      }
      // The trailing `;` is a sibling of the declaration, not a child, so the
      // value runs to the end of the node.
      if (colon) into.push(trim(state, colon.to, node.to));
    },
  });
}

function jsSlots(state: EditorState, from: number, to: number, into: Slot[]): void {
  syntaxTree(state).iterate({
    from,
    to,
    enter: (node) => {
      if (node.name === 'String') into.push(insideQuotes(state, node.from, node.to));
    },
  });
}

const FINDERS: Record<LangId, (state: EditorState, from: number, to: number, into: Slot[]) => void> = {
  html: htmlSlots,
  css: cssSlots,
  js: jsSlots,
};

class SlotChip extends WidgetType {
  constructor(readonly pos: number) {
    super();
  }

  override eq(other: SlotChip): boolean {
    return other.pos === this.pos;
  }

  toDOM(): HTMLElement {
    const chip = document.createElement('span');
    chip.className = 'cm-slot cm-slot-empty';
    chip.dataset.from = String(this.pos);
    chip.dataset.to = String(this.pos);
    chip.setAttribute('aria-hidden', 'true');
    return chip;
  }

  /**
   * A widget's DOM events are ignored by the editor by default, which would
   * also hide them from the shared mousedown handler below. Let them through:
   * the handler cancels the event, so the editor's own caret placement never
   * runs on top of it.
   */
  override ignoreEvent(): boolean {
    return false;
  }
}

function build(view: EditorView, language: LangId): DecorationSet {
  const found: Slot[] = [];
  for (const { from, to } of view.visibleRanges) FINDERS[language](view.state, from, to, found);

  found.sort((a, b) => a.from - b.from || a.to - b.to);

  const builder = new RangeSetBuilder<Decoration>();
  let last = -1;
  for (const slot of found) {
    if (slot.from < last) continue;
    last = slot.to;
    if (slot.from === slot.to) {
      builder.add(slot.from, slot.from, Decoration.widget({ widget: new SlotChip(slot.from), side: 0 }));
    } else {
      builder.add(
        slot.from,
        slot.to,
        Decoration.mark({
          class: 'cm-slot cm-slot-filled',
          attributes: { 'data-from': String(slot.from), 'data-to': String(slot.to) },
        }),
      );
    }
  }
  return builder.finish();
}

/**
 * Tapping a slot moves the caret there, or selects the value if there is one.
 * mousedown rather than click, so the caret never lands mid-word first.
 */
const press = EditorView.domEventHandlers({
  mousedown(event, view) {
    const target = (event.target as HTMLElement | null)?.closest?.('.cm-slot');
    if (!(target instanceof HTMLElement)) return false;
    const from = Number(target.dataset.from);
    const to = Number(target.dataset.to);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return false;
    event.preventDefault();
    view.dispatch({
      selection: from === to ? EditorSelection.cursor(from) : EditorSelection.range(from, to),
      scrollIntoView: true,
    });
    view.focus();
    return true;
  },
});

export function editableSlots(language: LangId): Extension {
  return [
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
          this.decorations = build(view, language);
        }

        update(update: ViewUpdate): void {
          // The tree arrives asynchronously on a big document, so a changed
          // tree counts as a reason to rebuild even without an edit.
          if (
            update.docChanged ||
            update.viewportChanged ||
            syntaxTree(update.startState) !== syntaxTree(update.state)
          ) {
            this.decorations = build(update.view, language);
          }
        }
      },
      { decorations: (plugin) => plugin.decorations },
    ),
    press,
  ];
}

export type { Range };
