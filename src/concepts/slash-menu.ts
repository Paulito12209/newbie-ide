/**
 * The slash menu: type `/` in the editor, pick a concept, get a short animated
 * explanation at the cursor.
 *
 * This module is a plain consumer of the editor's concept extension point. It
 * imports no CodeMirror API and touches no editor internals.
 *
 * It is explicitly NOT autocompletion: choosing an entry never inserts code. It
 * removes the `/query` you typed - which was never valid code to begin with -
 * and opens an explanation. The product teaches; it does not write for you.
 */
import { refreshConcepts, registerConceptProvider } from '../editor/concept-hook';
import type { ConceptKey, ConceptProvider, ConceptWidget, CursorContext } from '../editor/concept-hook';
import { CONCEPTS, search } from './catalog';
import type { Concept } from './catalog';
import './concepts.css';

/**
 * `/` only opens the menu at the start of a line or after a space, so `</div>`,
 * `//comment` and `a/b` are left alone.
 */
const TRIGGER = /(?:^|\s)\/([A-Za-z-]*)$/;

const BADGE: Record<string, string> = { html: 'HTML', css: 'CSS', js: 'JS' };

interface Trigger {
  query: string;
  /** Document offset of the `/`. */
  from: number;
  /** Identifies this exact prompt, so Escape can suppress just this one. */
  token: string;
}

// Module-scope state. The menu is a mode, not a component tree.
let selected = 0;
let suppressed: string | null = null;
let card: { id: string; line: number } | null = null;

function triggerAt(ctx: CursorContext): Trigger | null {
  if (!ctx.selectionEmpty || !ctx.hasFocus) return null;
  const match = TRIGGER.exec(ctx.line.text.slice(0, ctx.column));
  if (!match) return null;
  const query = match[1]!;
  return {
    query,
    from: ctx.line.from + ctx.column - (query.length + 1),
    token: `${ctx.line.number}:${query}`,
  };
}

function element(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/**
 * Acts on mousedown, not click.
 *
 * Hovering a row changes the selection, which re-renders the menu and replaces
 * these nodes - so a `click` listener would never fire, because mouseup lands on
 * a different element than mousedown did. preventDefault keeps focus in the
 * editor so typing continues afterwards.
 */
function onPress(node: HTMLElement, action: () => void): void {
  node.addEventListener('mousedown', (event) => {
    event.preventDefault();
    if ((event as MouseEvent).button === 0) action();
  });
}

function open(concept: Concept, ctx: CursorContext, trigger: Trigger): void {
  card = { id: concept.id, line: ctx.line.number };
  selected = 0;
  suppressed = null;
  // Remove the typed prompt. This is the only edit the teaching layer makes.
  ctx.replaceRange(trigger.from, ctx.pos);
}

function closeCard(): void {
  card = null;
  refreshConcepts();
}

function buildMenu(results: readonly Concept[], ctx: CursorContext, trigger: Trigger): HTMLElement {
  const anchor = element('span', 'sl-anchor');
  anchor.contentEditable = 'false';
  const menu = element('div', 'sl-menu');
  const list = element('div', 'sl-list');
  let active: HTMLElement | null = null;

  if (results.length === 0) {
    list.append(element('div', 'sl-empty', 'No concept matches "' + trigger.query + '"'));
  }

  results.forEach((concept, index) => {
    const row = element('div', 'sl-row' + (index === selected ? ' sl-active' : ''));
    if (index === selected) active = row;
    const head = element('div', 'sl-head');
    head.append(element('span', 'sl-title', concept.title));
    head.append(element('span', 'sl-badge', BADGE[concept.language]!));
    row.append(head);
    row.append(element('div', 'sl-desc', concept.summary));
    row.addEventListener('mouseenter', () => {
      if (selected === index) return;
      selected = index;
      refreshConcepts();
    });
    onPress(row, () => open(concept, ctx, trigger));
    list.append(row);
  });

  menu.append(list);
  menu.append(element('div', 'sl-foot', 'Enter to open, Esc to dismiss'));
  anchor.append(menu);

  // Measured once after mount, never during typing: the menu hangs off the
  // cursor, which can sit close to the right edge, and arrow-key navigation
  // has to keep the selected row visible.
  requestAnimationFrame(() => {
    const pane = anchor.closest('.cm-editor');
    if (pane) {
      const overflow = menu.getBoundingClientRect().right - (pane.getBoundingClientRect().right - 8);
      if (overflow > 0) menu.style.marginLeft = `${-overflow}px`;
    }
    active?.scrollIntoView({ block: 'nearest' });
  });

  return anchor;
}

function buildCard(concept: Concept): HTMLElement {
  const root = element('div', 'sl-card');
  root.contentEditable = 'false';

  const head = element('div', 'sl-head');
  head.append(element('span', 'sl-title', concept.title));
  head.append(element('span', 'sl-badge', BADGE[concept.language]!));
  const close = element('button', 'sl-close', 'Close');
  close.setAttribute('type', 'button');
  onPress(close, closeCard);
  head.append(close);

  root.append(head);
  root.append(element('p', 'sl-summary', concept.summary));
  root.append(concept.demo());
  return root;
}

const provider: ConceptProvider = {
  id: 'slash-menu',

  render(ctx: CursorContext): ConceptWidget | null {
    if (card) {
      // Walking to another line puts the explanation away.
      if (card.line !== ctx.line.number) card = null;
      else {
        const concept = CONCEPTS.find((entry) => entry.id === card!.id);
        if (!concept) card = null;
        // A stable key keeps the running animation alive while typing nearby.
        else return { dom: buildCard(concept), placement: 'below', key: 'card:' + concept.id };
      }
    }

    const trigger = triggerAt(ctx);
    if (!trigger) {
      selected = 0;
      suppressed = null;
      return null;
    }
    if (suppressed === trigger.token) return null;
    suppressed = null;

    const results = search(trigger.query, ctx.language);
    selected = results.length ? Math.min(selected, results.length - 1) : 0;

    return {
      dom: buildMenu(results, ctx, trigger),
      placement: 'inline',
      key: `menu:${trigger.token}:${selected}`,
    };
  },

  handleKey(key: ConceptKey, ctx: CursorContext): boolean {
    if (card && card.line === ctx.line.number) {
      if (key !== 'Escape') return false;
      closeCard();
      return true;
    }

    const trigger = triggerAt(ctx);
    if (!trigger || suppressed === trigger.token) return false;
    const results = search(trigger.query, ctx.language);

    switch (key) {
      case 'Escape':
        suppressed = trigger.token;
        refreshConcepts();
        return true;
      case 'ArrowDown':
      case 'ArrowUp': {
        if (results.length === 0) return false;
        const step = key === 'ArrowDown' ? 1 : -1;
        selected = (selected + step + results.length) % results.length;
        refreshConcepts();
        return true;
      }
      case 'Enter':
      case 'Tab': {
        const concept = results[selected];
        if (!concept) return false;
        open(concept, ctx, trigger);
        return true;
      }
      default:
        return false;
    }
  },
};

export function installSlashMenu(): () => void {
  return registerConceptProvider(provider);
}
