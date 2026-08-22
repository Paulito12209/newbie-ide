/**
 * Editor setup. Knows nothing about the preview or about concepts; it only
 * reports document changes and hosts the concept extension point.
 *
 * One EditorState per language, swapped with `view.setState`, so each tab keeps
 * its own undo history, cursor and scroll position.
 */
import { EditorView, drawSelection, highlightActiveLineGutter, keymap, lineNumbers } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import type { Text } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, indentOnInput, indentUnit } from '@codemirror/language';
import type { LangId } from '../state';
import { LANGS } from '../state';
import { closeBrackets } from './close-brackets';
import { conceptHost } from './concept-hook';
import { loadLanguage, peekLanguage } from './languages';
import { theme } from './theme';

export interface EditorOptions {
  docs: Record<LangId, string>;
  active: LangId;
  /**
   * Called on every document change. Receives the Text object rather than a
   * string: turning a document into a string is O(n) and must not happen on the
   * keystroke path. Callers stringify later, off the critical path.
   */
  onDocChanged: (lang: LangId, doc: Text) => void;
}

export interface EditorHandle {
  readonly view: EditorView;
  show(lang: LangId): void;
  focus(): void;
  destroy(): void;
}

export function createEditor(parent: HTMLElement, options: EditorOptions): EditorHandle {
  const states = new Map<LangId, EditorState>();
  const compartments = new Map<LangId, Compartment>();
  let current = options.active;

  function buildState(lang: LangId): EditorState {
    const compartment = new Compartment();
    compartments.set(lang, compartment);
    const mode = peekLanguage(lang);

    return EditorState.create({
      doc: options.docs[lang],
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
        conceptHost(lang),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) options.onDocChanged(lang, update.state.doc);
        }),
      ],
    });
  }

  function stateFor(lang: LangId): EditorState {
    let state = states.get(lang);
    if (!state) {
      state = buildState(lang);
      states.set(lang, state);
    }
    return state;
  }

  const view = new EditorView({ parent, state: stateFor(current) });

  /**
   * Attach a grammar that was not loaded yet. The tab switch itself never
   * waits on the network: the document is shown immediately, unhighlighted,
   * and gains highlighting a moment later.
   */
  function ensureMode(lang: LangId): void {
    if (peekLanguage(lang)) return;
    void loadLanguage(lang).then((mode) => {
      const compartment = compartments.get(lang);
      const state = states.get(lang);
      if (!compartment || !state) return;
      if (current === lang) {
        view.dispatch({ effects: compartment.reconfigure(mode) });
        states.set(lang, view.state);
      } else {
        states.set(lang, state.update({ effects: compartment.reconfigure(mode) }).state);
      }
    });
  }

  ensureMode(current);

  return {
    view,
    show(lang: LangId): void {
      if (lang === current) return;
      states.set(current, view.state);
      current = lang;
      view.setState(stateFor(lang));
      ensureMode(lang);
      view.focus();
    },
    focus(): void {
      view.focus();
    },
    destroy(): void {
      view.destroy();
      states.clear();
      compartments.clear();
    },
  };
}

export { LANGS };
