/**
 * A dots button 40px past the end of one line, opening that line's actions:
 * copy it, or clone it n times.
 *
 * Only ever one at a time, and which line depends on what you are pointing
 * with: on mobile it follows the caret, because the active line is the one you
 * are working on and there is no hover to speak of; on desktop it follows the
 * mouse, because hovering is how you say "this line" without clicking into it.
 */
import { Decoration, EditorView, ViewPlugin, WidgetType } from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { MOBILE_QUERY } from '../ui/mobile';
import { copyText } from '../ui/clipboard';
import { ICON_DOTS } from '../ui/icons';
import { openLineActions } from '../ui/line-actions';

class LineDots extends WidgetType {
  constructor(readonly pos: number) {
    super();
  }

  override eq(other: LineDots): boolean {
    return other.pos === this.pos;
  }

  toDOM(): HTMLElement {
    const button = document.createElement('span');
    button.className = 'cm-line-menu';
    button.innerHTML = ICON_DOTS;
    button.dataset.pos = String(this.pos);
    button.setAttribute('role', 'button');
    button.setAttribute('aria-label', 'Line actions');
    return button;
  }

  /** Let the shared handler below see the tap. */
  override ignoreEvent(): boolean {
    return false;
  }
}

function build(view: EditorView, hovered: number | null): DecorationSet {
  const onMobile = window.matchMedia(MOBILE_QUERY).matches;
  const number = onMobile ? view.state.doc.lineAt(view.state.selection.main.head).number : hovered;
  if (number == null || number < 1 || number > view.state.doc.lines) return Decoration.none;

  const line = view.state.doc.line(number);
  // Nothing to copy or clone on a blank line.
  if (line.text.trim() === '') return Decoration.none;

  return Decoration.set([
    Decoration.widget({ widget: new LineDots(line.to), side: 1 }).range(line.to),
  ]);
}

const press = EditorView.domEventHandlers({
  mousedown(event, view) {
    const target = (event.target as HTMLElement | null)?.closest?.('.cm-line-menu');
    if (!(target instanceof HTMLElement)) return false;
    const pos = Number(target.dataset.pos);
    if (!Number.isFinite(pos)) return false;
    event.preventDefault();

    const line = view.state.doc.lineAt(pos);
    openLineActions({
      anchor: target.getBoundingClientRect(),
      onCopy: () => copyText(line.text.trim()),
      onDelete: () => {
        // Take the line break with it, so deleting does not leave a blank line.
        // On the last line there is no break after, so eat the one before.
        const doc = view.state.doc;
        const from = line.to < doc.length ? line.from : Math.max(0, line.from - 1);
        const to = line.to < doc.length ? line.to + 1 : line.to;
        view.dispatch({ changes: { from, to, insert: '' }, selection: { anchor: from }, scrollIntoView: true });
      },
      onClone: (times) => {
        const insert = `\n${line.text}`.repeat(times);
        view.dispatch({
          changes: { from: line.to, insert },
          selection: { anchor: line.to + insert.length },
          scrollIntoView: true,
        });
      },
    });
    return true;
  },
});

export function lineMenu(): Extension {
  return [
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;
        /** Only meaningful on desktop; mobile follows the caret instead. */
        private hovered: number | null = null;
        private frame = 0;

        constructor(readonly view: EditorView) {
          this.decorations = build(view, null);
          view.dom.addEventListener('mousemove', this.onMove);
          view.dom.addEventListener('mouseleave', this.onLeave);
        }

        private onMove = (event: MouseEvent): void => {
          if (window.matchMedia(MOBILE_QUERY).matches) return;
          if (this.frame) return;
          // posAtCoords on every mousemove would be wasteful; once a frame is
          // more than enough to keep up with a pointer.
          this.frame = requestAnimationFrame(() => {
            this.frame = 0;
            // Never dispatch into a composing view; see concept-hook.ts.
            if (this.view.composing) return;
            const pos = this.view.posAtCoords({ x: event.clientX, y: event.clientY });
            const next = pos == null ? null : this.view.state.doc.lineAt(pos).number;
            if (next === this.hovered) return;
            this.hovered = next;
            this.decorations = build(this.view, this.hovered);
            this.view.requestMeasure();
            this.view.dispatch({});
          });
        };

        private onLeave = (): void => {
          if (this.hovered == null || this.view.composing) return;
          this.hovered = null;
          this.decorations = build(this.view, null);
          this.view.dispatch({});
        };

        update(update: ViewUpdate): void {
          if (update.docChanged || update.selectionSet || update.viewportChanged) {
            this.decorations = build(update.view, this.hovered);
          }
        }

        destroy(): void {
          if (this.frame) cancelAnimationFrame(this.frame);
          this.view.dom.removeEventListener('mousemove', this.onMove);
          this.view.dom.removeEventListener('mouseleave', this.onLeave);
        }
      },
      { decorations: (plugin) => plugin.decorations },
    ),
    press,
  ];
}
