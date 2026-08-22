/**
 * Line selection: tick several lines, then do one thing to all of them.
 *
 * Reached from a line's dots menu. While it is on, every line with code gets a
 * round checkbox at the right-hand end and a bar appears above the file bar
 * with what you can do: copy, clone or delete the ticked lines.
 *
 * Editing is not the point here, so any document change while selecting simply
 * ends the mode - a selection of line numbers stops meaning anything the moment
 * the lines move.
 */
import { Decoration, EditorView, ViewPlugin, WidgetType } from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';
import { StateEffect, StateField } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import { copyText } from '../ui/clipboard';

const setActive = StateEffect.define<boolean>();
const toggleLine = StateEffect.define<number>();

interface SelectState {
  active: boolean;
  lines: readonly number[];
}

const field = StateField.define<SelectState>({
  create: () => ({ active: false, lines: [] }),
  update(value, tr) {
    // Line numbers stop meaning anything once the text moves.
    if (tr.docChanged) return value.active ? { active: false, lines: [] } : value;
    for (const effect of tr.effects) {
      if (effect.is(setActive)) return { active: effect.value, lines: [] };
      if (effect.is(toggleLine) && value.active) {
        const has = value.lines.includes(effect.value);
        return {
          active: true,
          lines: has ? value.lines.filter((n) => n !== effect.value) : [...value.lines, effect.value].sort((a, b) => a - b),
        };
      }
    }
    return value;
  },
});

export function isSelecting(view: EditorView): boolean {
  return view.state.field(field).active;
}

export function startSelecting(view: EditorView): void {
  view.dispatch({ effects: setActive.of(true) });
  view.focus();
}

function stop(view: EditorView): void {
  view.dispatch({ effects: setActive.of(false) });
}

class Checkbox extends WidgetType {
  constructor(
    readonly line: number,
    readonly checked: boolean,
  ) {
    super();
  }

  override eq(other: Checkbox): boolean {
    return other.line === this.line && other.checked === this.checked;
  }

  toDOM(): HTMLElement {
    const box = document.createElement('span');
    box.className = 'cm-line-check' + (this.checked ? ' cm-line-check-on' : '');
    box.dataset.line = String(this.line);
    box.setAttribute('role', 'checkbox');
    box.setAttribute('aria-checked', String(this.checked));
    box.setAttribute('aria-label', `Select line ${this.line}`);
    return box;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

function build(view: EditorView): DecorationSet {
  const state = view.state.field(field);
  if (!state.active) return Decoration.none;

  const marks = [];
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to; ) {
      const line = view.state.doc.lineAt(pos);
      if (line.text.trim() !== '') {
        marks.push(
          Decoration.widget({
            widget: new Checkbox(line.number, state.lines.includes(line.number)),
            side: 1,
          }).range(line.to),
        );
      }
      pos = line.to + 1;
    }
  }
  return Decoration.set(marks, true);
}

// --- the action bar ----------------------------------------------------------

let bar: HTMLElement | null = null;

function label(count: number): string {
  return count === 1 ? '1 line' : `${count} lines`;
}

function renderBar(view: EditorView): void {
  const state = view.state.field(field);
  if (!state.active) {
    bar?.remove();
    bar = null;
    return;
  }

  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'sl-select-bar';
    document.body.append(bar);
  }

  const lines = () => state.lines.map((n) => view.state.doc.line(n));
  const action = (text: string, run: () => void, className = ''): HTMLButtonElement => {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = `sl-select-action ${className}`.trim();
    node.textContent = text;
    node.disabled = state.lines.length === 0;
    node.addEventListener('click', run);
    return node;
  };

  const count = document.createElement('span');
  count.className = 'sl-select-count';
  count.textContent = state.lines.length ? `${label(state.lines.length)} selected` : 'Tap the circles';

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'sl-select-done';
  close.textContent = 'Done';
  close.addEventListener('click', () => stop(view));

  bar.replaceChildren(
    count,
    action('Copy', () => {
      copyText(lines().map((line) => line.text.trim()).join('\n'));
      stop(view);
    }),
    action('Clone', () => {
      // The block is put back directly under itself, in document order.
      const text = lines().map((line) => line.text).join('\n');
      const last = lines()[lines().length - 1]!;
      view.dispatch({ changes: { from: last.to, insert: `\n${text}` }, scrollIntoView: true });
    }),
    action(
      'Delete',
      () => {
        // Bottom up, so the earlier positions stay valid.
        const changes = lines()
          .slice()
          .reverse()
          .map((line) => ({
            from: line.from,
            to: line.to < view.state.doc.length ? line.to + 1 : line.to,
          }));
        view.dispatch({ changes, scrollIntoView: true });
      },
      'sl-select-danger',
    ),
    close,
  );
}

const press = EditorView.domEventHandlers({
  click(event, view) {
    const box = (event.target as HTMLElement | null)?.closest?.('.cm-line-check');
    if (!(box instanceof HTMLElement)) return false;
    const line = Number(box.dataset.line);
    if (!Number.isFinite(line)) return false;
    view.dispatch({ effects: toggleLine.of(line) });
    return true;
  },
});

export function lineSelect(): Extension {
  return [
    field,
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;

        constructor(readonly view: EditorView) {
          this.decorations = build(view);
          renderBar(view);
        }

        update(update: ViewUpdate): void {
          const changed = update.startState.field(field) !== update.state.field(field);
          if (changed || update.docChanged || update.viewportChanged) {
            this.decorations = build(update.view);
          }
          if (changed) renderBar(update.view);
        }

        destroy(): void {
          bar?.remove();
          bar = null;
        }
      },
      { decorations: (plugin) => plugin.decorations },
    ),
    press,
  ];
}
