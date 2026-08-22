/**
 * Editor setup. Knows nothing about the preview or about concepts; it only
 * reports document changes and hosts the concept extension point.
 *
 * One EditorState per file, swapped with `view.setState`, so every tab keeps its
 * own undo history, cursor and scroll position. States are keyed by file id, so
 * a rename keeps all of that.
 */
import { EditorView, drawSelection, highlightActiveLineGutter, keymap, lineNumbers } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import type { Text } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, indentOnInput, indentUnit } from '@codemirror/language';
import type { FileDoc, LangId } from '../state';
import { closeBrackets } from './close-brackets';
import { conceptHost } from './concept-hook';
import { loadLanguage, peekLanguage } from './languages';
import { theme } from './theme';

export interface EditorOptions {
  initial: FileDoc;
  /**
   * Called on every document change. Receives the Text object rather than a
   * string: turning a document into a string is O(n) and must not happen on the
   * keystroke path. Callers stringify later, off the critical path.
   */
  onDocChanged: (fileId: string, doc: Text) => void;
}

export interface EditorHandle {
  readonly view: EditorView;
  show(file: FileDoc): void;
  /** Drop a deleted file's state so it cannot come back. */
  forget(fileId: string): void;
  focus(): void;
  destroy(): void;
}

interface Slot {
  state: EditorState;
  kind: LangId;
  compartment: Compartment;
}

export function createEditor(parent: HTMLElement, options: EditorOptions): EditorHandle {
  const slots = new Map<string, Slot>();
  let current = options.initial.id;

  function build(file: FileDoc): Slot {
    const compartment = new Compartment();
    const mode = peekLanguage(file.kind);

    const state = EditorState.create({
      doc: file.text,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        drawSelection(),
        history(),
        bracketMatching(),
        closeBrackets(),
        indentOnInput(),
        indentUnit.of('  '),
        EditorState.tabSize.of(2),
        EditorView.lineWrapping,
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        theme,
        compartment.of(mode ?? []),
        conceptHost(file.kind),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) options.onDocChanged(file.id, update.state.doc);
        }),
      ],
    });

    return { state, kind: file.kind, compartment };
  }

  function slotFor(file: FileDoc): Slot {
    const existing = slots.get(file.id);
    // A rename that changes the extension changes the language, and that is the
    // one case where the state has to be rebuilt.
    if (existing && existing.kind === file.kind) return existing;
    const slot = build(file);
    slots.set(file.id, slot);
    return slot;
  }

  const view = new EditorView({ parent, state: slotFor(options.initial).state });

  /**
   * Attach a grammar that was not loaded yet. Switching files never waits on the
   * network: the document shows immediately, unhighlighted, and gains
   * highlighting a moment later.
   */
  function ensureMode(file: FileDoc): void {
    if (peekLanguage(file.kind)) return;
    void loadLanguage(file.kind).then((mode) => {
      const slot = slots.get(file.id);
      if (!slot) return;
      if (current === file.id) {
        view.dispatch({ effects: slot.compartment.reconfigure(mode) });
        slot.state = view.state;
      } else {
        slot.state = slot.state.update({ effects: slot.compartment.reconfigure(mode) }).state;
      }
    });
  }

  ensureMode(options.initial);

  return {
    view,
    show(file: FileDoc): void {
      const slot = slots.get(current);
      if (slot) slot.state = view.state;
      current = file.id;
      view.setState(slotFor(file).state);
      ensureMode(file);
      view.focus();
    },
    forget(fileId: string): void {
      slots.delete(fileId);
    },
    focus(): void {
      view.focus();
    },
    destroy(): void {
      view.destroy();
      slots.clear();
    },
  };
}
