/**
 * The extension point for the concept-teaching layer.
 *
 * The editor knows nothing about concepts. It offers exactly three things:
 * cursor context, a place to render DOM, and a channel for the handful of
 * navigation keys an inline UI needs. Everything else - what a concept is, how
 * it is triggered, what it looks like - lives in `src/concepts/`.
 *
 * Contract:
 *  - Providers are called at most once per animation frame, never inside the
 *    CodeMirror update cycle.
 *  - A provider that returns null renders nothing and costs nothing.
 *  - With no providers registered the host does zero work per update.
 *  - A provider that throws is logged and isolated; the editor keeps working.
 */
import { Decoration, EditorView, ViewPlugin, WidgetType, keymap } from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';
import { Prec, StateEffect, StateField } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import type { LangId } from '../state';

/** The only keys a provider may take over, and only while it is active. */
export type ConceptKey = 'ArrowUp' | 'ArrowDown' | 'Enter' | 'Tab' | 'Escape';

const NAV_KEYS: readonly ConceptKey[] = ['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'];

/** Everything a concept provider is allowed to know about the editor. */
export interface CursorContext {
  /** Language of the document the cursor is in. */
  language: LangId;
  /** Absolute document offset of the cursor head. */
  pos: number;
  /** The line the cursor is on. */
  line: { number: number; from: number; to: number; text: string };
  /** Zero-based column of the cursor within that line. */
  column: number;
  /** False when the user has a range selected. */
  selectionEmpty: boolean;
  /** True while the editor has DOM focus. */
  hasFocus: boolean;
  /**
   * Narrow write access. Deliberately the only way the teaching layer can touch
   * the document.
   *
   * `caret` is an offset into the inserted text and defaults to its end, which
   * is what a provider needs to drop the cursor inside a pair it just wrote.
   */
  replaceRange(from: number, to: number, insert?: string, caret?: number): void;
}

export interface ConceptWidget {
  /** Element to mount. Owned by the host once returned. */
  dom: HTMLElement;
  /** 'inline' sits at the cursor; 'below' takes its own block under the line. */
  placement?: 'inline' | 'below';
  /**
   * Stable identity. Widgets with an equal key are treated as unchanged, so the
   * host keeps the existing DOM instead of remounting it every keystroke.
   */
  key?: string;
  destroy?(): void;
}

export interface ConceptProvider {
  id: string;
  render(ctx: CursorContext): ConceptWidget | null;
  /**
   * Optional. Called before the editor's own binding for these keys, so an
   * open inline UI can navigate. Return true to consume the key; return false
   * whenever the provider is idle, or normal editing breaks.
   */
  handleKey?(key: ConceptKey, ctx: CursorContext): boolean;
}

const providers = new Set<ConceptProvider>();
const hosts = new Set<EditorView>();

/** Register a provider. Returns an unsubscribe function. */
export function registerConceptProvider(provider: ConceptProvider): () => void {
  providers.add(provider);
  refreshConcepts();
  return () => {
    providers.delete(provider);
    refreshConcepts();
  };
}

/** Ask every live editor to re-run its providers (after async data, or a state change inside a provider). */
export function refreshConcepts(): void {
  // With the last provider gone there is nothing left to recompute, but any
  // widget still on screen has to be cleared explicitly.
  const effect = providers.size === 0 ? setWidgets.of(Decoration.none) : recompute.of(null);
  for (const view of hosts) view.dispatch({ effects: effect });
}

const recompute = StateEffect.define<null>();
const setWidgets = StateEffect.define<DecorationSet>();

const conceptField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    for (const effect of tr.effects) if (effect.is(setWidgets)) return effect.value;
    return tr.docChanged ? value.map(tr.changes) : value;
  },
  provide: (field) => EditorView.decorations.from(field),
});

class ConceptWidgetType extends WidgetType {
  constructor(
    readonly widget: ConceptWidget,
    readonly providerId: string,
  ) {
    super();
  }

  override eq(other: ConceptWidgetType): boolean {
    if (other.providerId !== this.providerId) return false;
    const key = this.widget.key;
    return key != null && key === other.widget.key;
  }

  toDOM(): HTMLElement {
    return this.widget.dom;
  }

  override destroy(): void {
    this.widget.destroy?.();
  }
}

function contextOf(view: EditorView, language: LangId): CursorContext {
  const { state } = view;
  const range = state.selection.main;
  const line = state.doc.lineAt(range.head);
  return {
    language,
    pos: range.head,
    line: { number: line.number, from: line.from, to: line.to, text: line.text },
    column: range.head - line.from,
    selectionEmpty: range.empty,
    hasFocus: view.hasFocus,
    replaceRange(from, to, insert = '', caret = insert.length) {
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + Math.max(0, Math.min(caret, insert.length)) },
        userEvent: 'input.concept',
        scrollIntoView: true,
      });
    },
  };
}

function runProvider<T>(provider: ConceptProvider, work: () => T, fallback: T): T {
  try {
    return work();
  } catch (error) {
    // A broken teaching module must not break the editor.
    console.error(`[concept:${provider.id}]`, error);
    return fallback;
  }
}

/**
 * Mounts the concept extension point into an editor state.
 * `language` is fixed per document, which is why it is passed in here.
 */
export function conceptHost(language: LangId): Extension {
  const navigation = keymap.of(
    NAV_KEYS.map((key) => ({
      key,
      run: (view: EditorView) => {
        if (providers.size === 0) return false;
        const ctx = contextOf(view, language);
        for (const provider of providers) {
          if (!provider.handleKey) continue;
          if (runProvider(provider, () => provider.handleKey!(key, ctx), false)) return true;
        }
        return false;
      },
    })),
  );

  return [
    conceptField,
    // Above the default keymap, so an open menu owns Enter and the arrows -
    // but only for as long as a provider actually claims them.
    Prec.highest(navigation),
    ViewPlugin.fromClass(
      class {
        private frame = 0;

        constructor(readonly view: EditorView) {
          hosts.add(view);
        }

        update(update: ViewUpdate): void {
          if (providers.size === 0) return;
          const triggered =
            update.docChanged ||
            update.selectionSet ||
            update.focusChanged ||
            update.transactions.some((tr) => tr.effects.some((e) => e.is(recompute)));
          if (triggered) this.schedule();
        }

        /**
         * Provider work is deliberately pushed out of the update cycle: a
         * provider building DOM must never sit between a keystroke and its
         * paint.
         */
        private schedule(): void {
          if (this.frame) return;
          this.frame = requestAnimationFrame(() => {
            this.frame = 0;
            // Dispatching into a view that is mid-composition corrupts the
            // input: Android keyboards compose a whole word before committing
            // it, and an unrelated transaction makes them re-send or replace
            // what is already there. Wait for the word to land.
            if (this.view.composing) {
              this.schedule();
              return;
            }
            this.run();
          });
        }

        private run(): void {
          const ctx = contextOf(this.view, language);
          const ranges = [];

          for (const provider of providers) {
            const widget = runProvider(provider, () => provider.render(ctx), null);
            if (!widget) continue;
            const below = widget.placement === 'below';
            ranges.push(
              Decoration.widget({
                widget: new ConceptWidgetType(widget, provider.id),
                side: 1,
                block: below,
              }).range(below ? ctx.line.to : ctx.pos),
            );
          }

          this.view.dispatch({ effects: setWidgets.of(Decoration.set(ranges, true)) });
        }

        destroy(): void {
          if (this.frame) cancelAnimationFrame(this.frame);
          hosts.delete(this.view);
        }
      },
    ),
  ];
}
