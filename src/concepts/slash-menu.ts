/**
 * The slash menu: type `/` in the editor and pick something.
 *
 * Two kinds of entry share the list:
 *  - **tags** (HTML files only) insert markup, because `<` and `>` sit two
 *    layers deep on a phone keyboard. Every row shows the markup it will
 *    insert, so the brackets you did not type are still the brackets you see.
 *  - **concepts** insert nothing. They open a short animated explanation.
 *
 * This module is a plain consumer of the editor's concept extension point. It
 * imports no CodeMirror API and touches no editor internals.
 */
import { refreshConcepts, registerConceptProvider } from '../editor/concept-hook';
import type { ConceptKey, ConceptProvider, ConceptWidget, CursorContext } from '../editor/concept-hook';
import { CONCEPTS } from './catalog';
import type { Concept } from './catalog';
import { TAGS, expand, preview } from './tags';
import type { TagEntry } from './tags';
import type { LangId } from '../state';
import './concepts.css';

/**
 * `/` only opens the menu at the start of a line or after a space, so `</div>`,
 * `//comment` and `a / b` are left alone.
 */
const TRIGGER = /(?:^|\s)\/([A-Za-z1-6-]*)$/;

/**
 * Pressing Enter here means "I finished that element, give me the next one".
 * Deliberately only a closing tag: after an opening tag or mid-attribute the
 * cursor may be somewhere a new element makes no sense.
 */
const AFTER_CLOSING_TAG = /<\/[a-zA-Z][\w-]*\s*>[ \t]*$/;

const BADGE: Record<string, string> = { html: 'HTML', css: 'CSS', js: 'JS' };

type Entry = { kind: 'tag'; tag: TagEntry } | { kind: 'concept'; concept: Concept };

interface Trigger {
  query: string;
  /** Document offset of the `/`. */
  from: number;
  /** Identifies this exact prompt, so Escape can suppress just this one. */
  token: string;
  /** Leading whitespace of the line, so a multi-line snippet lands straight. */
  indent: string;
}

// Module-scope state. The menu is a mode, not a component tree.
let selected = 0;
let suppressed: string | null = null;
let card: { id: string; line: number } | null = null;
/** True while the open prompt was opened by Enter rather than typed. */
let autoSlash = false;

function triggerAt(ctx: CursorContext): Trigger | null {
  if (!ctx.selectionEmpty || !ctx.hasFocus) return null;
  const before = ctx.line.text.slice(0, ctx.column);
  const match = TRIGGER.exec(before);
  if (!match) return null;
  const query = match[1]!;
  return {
    query,
    from: ctx.line.from + ctx.column - (query.length + 1),
    token: `${ctx.line.number}:${query}`,
    indent: /^[ \t]*/.exec(ctx.line.text)![0]!,
  };
}

function score(haystack: string, query: string): number {
  if (haystack === query) return 4;
  if (haystack.startsWith(query)) return 3;
  if (haystack.includes(query)) return 2;
  return -1;
}

/**
 * Ranks both kinds together. Tags only exist for HTML; concepts from the active
 * language rank first but the others stay reachable, so someone writing CSS can
 * still look up "loop".
 */
function searchEntries(query: string, language: LangId): Entry[] {
  const q = query.trim().toLowerCase();
  const scored: { entry: Entry; score: number }[] = [];

  if (language === 'html') {
    for (const tag of TAGS) {
      const value = q ? score(tag.id, q) : 1;
      // A tag you named exactly is what you meant; nothing should outrank it.
      if (value >= 0) scored.push({ entry: { kind: 'tag', tag }, score: value + 1 });
    }
  }

  for (const concept of CONCEPTS) {
    let value = -1;
    if (!q) value = 0;
    else {
      value = Math.max(score(concept.id, q), score(concept.title.toLowerCase(), q));
      if (value < 0 && concept.keywords.some((word) => word.toLowerCase().startsWith(q))) value = 1;
    }
    if (value >= 0) scored.push({ entry: { kind: 'concept', concept }, score: value + (concept.language === language ? 0.5 : 0) });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map((item) => item.entry);
}

function element(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/** Keeps the editor focused when the mouse is used, so typing continues afterwards. */
function onPress(node: HTMLElement, action: () => void): void {
  node.addEventListener('mousedown', (event) => {
    event.preventDefault();
    if ((event as MouseEvent).button === 0) action();
  });
}

function choose(entry: Entry, ctx: CursorContext, trigger: Trigger): void {
  selected = 0;
  suppressed = null;
  autoSlash = false;

  if (entry.kind === 'tag') {
    // The only case where the teaching layer writes code, and only because the
    // characters it writes are the ones a phone keyboard hides.
    const { text, caret } = expand(entry.tag, trigger.indent);
    ctx.replaceRange(trigger.from, ctx.pos, text, caret);
    return;
  }

  card = { id: entry.concept.id, line: ctx.line.number };
  ctx.replaceRange(trigger.from, ctx.pos);
}

function closeCard(): void {
  card = null;
  refreshConcepts();
}

function buildMenu(entries: readonly Entry[], ctx: CursorContext, trigger: Trigger): HTMLElement {
  const anchor = element('span', 'sl-anchor');
  anchor.contentEditable = 'false';
  const menu = element('div', 'sl-menu');
  const list = element('div', 'sl-list');
  let active: HTMLElement | null = null;

  if (entries.length === 0) {
    list.append(element('div', 'sl-empty', 'Nothing matches "' + trigger.query + '"'));
  }

  entries.forEach((entry, index) => {
    const row = element('div', 'sl-row' + (index === selected ? ' sl-active' : ''));
    if (index === selected) active = row;

    const head = element('div', 'sl-head');
    const isTag = entry.kind === 'tag';
    head.append(element('span', 'sl-title', isTag ? entry.tag.label : entry.concept.title));
    head.append(
      element('span', 'sl-badge' + (isTag ? ' sl-badge-tag' : ''), isTag ? 'TAG' : BADGE[entry.concept.language]!),
    );
    row.append(head);

    if (isTag) {
      // Show the markup: the point is that you learn it, not that it is hidden.
      row.append(element('code', 'sl-markup', preview(entry.tag)));
      row.append(element('div', 'sl-desc', entry.tag.summary));
    } else {
      row.append(element('div', 'sl-desc', entry.concept.summary));
    }

    row.addEventListener('mouseenter', () => {
      if (selected === index) return;
      selected = index;
      refreshConcepts();
    });
    onPress(row, () => choose(entry, ctx, trigger));
    list.append(row);
  });

  menu.append(list);
  menu.append(element('div', 'sl-foot', 'Enter to use, Esc to dismiss'));
  anchor.append(menu);

  // Measured once after mount, never during typing. The menu hangs off the
  // cursor, so it has to be kept inside the pane in both directions - and with
  // a keyboard up there is often no room below the cursor at all.
  requestAnimationFrame(() => {
    const pane = anchor.closest('.cm-editor');
    if (pane) {
      const paneBox = pane.getBoundingClientRect();
      const anchorBox = anchor.getBoundingClientRect();

      const overflow = menu.getBoundingClientRect().right - (paneBox.right - 8);
      if (overflow > 0) menu.style.marginLeft = `${-overflow}px`;

      // The mobile file bar floats over the bottom of the pane, so the usable
      // area ends where it starts.
      const bar = document.getElementById('tabs');
      const floating = bar && getComputedStyle(bar).position === 'absolute';
      const limit = floating ? bar.getBoundingClientRect().top : paneBox.bottom;

      const below = limit - anchorBox.bottom - 12;
      const above = anchorBox.top - paneBox.top - 12;
      const footer = 28;

      if (above > below) {
        menu.style.top = 'auto';
        menu.style.bottom = '1.5em';
        list.style.maxHeight = `${Math.max(80, above - footer)}px`;
      } else {
        list.style.maxHeight = `${Math.max(80, Math.min(216, below - footer))}px`;
      }
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
      autoSlash = false;
      return null;
    }
    if (suppressed === trigger.token) return null;
    suppressed = null;

    const entries = searchEntries(trigger.query, ctx.language);
    selected = entries.length ? Math.min(selected, entries.length - 1) : 0;

    return {
      dom: buildMenu(entries, ctx, trigger),
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

    if (!trigger || suppressed === trigger.token) {
      // Finished an element and pressed Enter: open the next line already
      // prompting, so the tag list is one keystroke away instead of two
      // keyboard layers.
      if (key !== 'Enter' || ctx.language !== 'html') return false;
      if (!AFTER_CLOSING_TAG.test(ctx.line.text.slice(0, ctx.column))) return false;
      const indent = /^[ \t]*/.exec(ctx.line.text)![0]!;
      suppressed = null;
      selected = 0;
      autoSlash = true;
      ctx.replaceRange(ctx.pos, ctx.pos, `\n${indent}/`);
      return true;
    }

    const entries = searchEntries(trigger.query, ctx.language);

    switch (key) {
      case 'Escape':
        // A slash the user never typed should not be left behind.
        if (autoSlash && trigger.query === '') {
          autoSlash = false;
          ctx.replaceRange(trigger.from, ctx.pos);
        } else {
          suppressed = trigger.token;
        }
        refreshConcepts();
        return true;
      case 'ArrowDown':
      case 'ArrowUp': {
        if (entries.length === 0) return false;
        const step = key === 'ArrowDown' ? 1 : -1;
        selected = (selected + step + entries.length) % entries.length;
        refreshConcepts();
        return true;
      }
      case 'Enter':
      case 'Tab': {
        const entry = entries[selected];
        if (!entry) return false;
        choose(entry, ctx, trigger);
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
