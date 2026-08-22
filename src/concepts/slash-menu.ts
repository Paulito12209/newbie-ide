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
import { layouts, preview as layoutPreview } from './layouts';
import type { LayoutEntry } from './layouts';
import type { Workspace } from './workspace';
import type { LangId } from '../state';
import { session } from '../state';
import './concepts.css';

/**
 * `/` only opens the menu at the start of a line or after a space, so `</div>`,
 * `//comment` and `a / b` are left alone.
 */
const TRIGGER = /(?:^|\s)\/([A-Za-z0-9-]*)$/;

/**
 * Pressing Enter here means "I finished that element, give me the next one".
 * Deliberately only a closing tag: after an opening tag or mid-attribute the
 * cursor may be somewhere a new element makes no sense.
 */
const AFTER_CLOSING_TAG = /<\/[a-zA-Z][\w-]*\s*>[ \t]*$/;

const BADGE: Record<string, string> = { html: 'HTML', css: 'CSS', js: 'JS' };

type Entry =
  | { kind: 'tag'; tag: TagEntry }
  | { kind: 'layout'; layout: LayoutEntry }
  | { kind: 'concept'; concept: Concept };

/** Set once at install time; layouts need to write into the stylesheet. */
let workspace: Workspace | null = null;

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

/**
 * A query cannot contain a space - one ends the prompt - so "3 columns" has to
 * be reachable as `3col`. Both sides are stripped to letters and digits before
 * comparing, which makes label, id and keyword all match the same way.
 */
const normalize = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]/g, '');

function score(haystack: string, query: string): number {
  const hay = normalize(haystack);
  if (hay === query) return 4;
  if (hay.startsWith(query)) return 3;
  if (hay.includes(query)) return 2;
  return -1;
}

/** Best score across everything an entry can be called. */
function scoreAliases(aliases: readonly string[], query: string): number {
  let best = -1;
  for (const alias of aliases) best = Math.max(best, score(alias, query));
  return best;
}

/**
 * Ranks both kinds together. Tags only exist for HTML; concepts from the active
 * language rank first but the others stay reachable, so someone writing CSS can
 * still look up "loop".
 */
function searchEntries(query: string, language: LangId): Entry[] {
  const q = normalize(query);
  const scored: { entry: Entry; score: number }[] = [];

  if (language === 'html') {
    for (const layout of layouts(session.rules.grid)) {
      const value = q ? scoreAliases([layout.id, layout.label, ...layout.keywords], q) : 1;
      if (value >= 0) scored.push({ entry: { kind: 'layout', layout }, score: value + 1 });
    }

    for (const tag of TAGS) {
      const value = q ? scoreAliases([tag.id, tag.label], q) : 1;
      // A tag you named exactly is what you meant; nothing should outrank it.
      if (value >= 0) scored.push({ entry: { kind: 'tag', tag }, score: value + 1 });
    }
  }

  for (const concept of CONCEPTS) {
    const value = q ? scoreAliases([concept.id, concept.title, ...concept.keywords], q) : 0;
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

  if (entry.kind === 'tag' || entry.kind === 'layout') {
    // The only case where the teaching layer writes code, and only because the
    // characters it writes are the ones a phone keyboard hides.
    const snippet = entry.kind === 'tag' ? entry.tag.snippet : entry.layout.html;
    const { text, caret } = expand(snippet, trigger.indent);
    ctx.replaceRange(trigger.from, ctx.pos, text, caret);
    // A layout is markup plus the rules that make it a layout. Both land in
    // real files; nothing is applied invisibly.
    if (entry.kind === 'layout') workspace?.ensureCss(entry.layout.css);
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
    const title =
      entry.kind === 'tag' ? entry.tag.label : entry.kind === 'layout' ? entry.layout.label : entry.concept.title;
    const badge =
      entry.kind === 'tag' ? 'TAG' : entry.kind === 'layout' ? 'LAYOUT' : BADGE[entry.concept.language]!;
    head.append(element('span', 'sl-title', title));
    head.append(element('span', `sl-badge${entry.kind === 'concept' ? '' : ' sl-badge-tag'}`, badge));
    row.append(head);

    // Show the markup: the point is that you learn it, not that it is hidden.
    if (entry.kind === 'tag') {
      row.append(element('code', 'sl-markup', preview(entry.tag)));
      row.append(element('div', 'sl-desc', entry.tag.summary));
    } else if (entry.kind === 'layout') {
      row.append(element('code', 'sl-markup', layoutPreview(entry.layout)));
      row.append(element('div', 'sl-desc', `${entry.layout.summary}, with its CSS added to the stylesheet`));
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

export function installSlashMenu(host: Workspace): () => void {
  workspace = host;
  return registerConceptProvider(provider);
}
