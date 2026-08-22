/**
 * The concept catalogue: what the slash menu can explain.
 *
 * Every entry is a short plain-language summary plus a small animated demo.
 * Demos are built from static author-written markup and animated purely in CSS
 * (see concepts.css), so an open card costs no scripting and no timers.
 *
 * Adding a concept means adding an entry here. Nothing else changes.
 */
import type { LangId } from '../state';

export interface Concept {
  id: string;
  title: string;
  /** Which tab this concept belongs to. */
  language: LangId;
  /** Extra words the menu should match on. */
  keywords: string[];
  /** One or two sentences, beginner vocabulary, no jargon left unexplained. */
  summary: string;
  /** Builds the animated illustration. Called once per opened card. */
  demo(): HTMLElement;
}

/** Static, author-written markup only - never user input. */
function demo(className: string, html: string): HTMLElement {
  const root = document.createElement('div');
  root.className = 'cd ' + className;
  root.innerHTML = html;
  return root;
}

const cycle = (width: string, steps: string[]): string =>
  `<span class="cd-cycle cd-cycle-${steps.length}" style="--w:${width}">` +
  steps.map((text, i) => `<span style="--i:${i}">${text}</span>`).join('') +
  '</span>';

export const CONCEPTS: readonly Concept[] = [
  // --- HTML ----------------------------------------------------------------
  {
    id: 'element',
    title: 'Element',
    language: 'html',
    keywords: ['tag', 'html', 'markup'],
    summary:
      'An element wraps content in an opening tag and a closing tag. The browser reads the tag to decide what the content is: a heading, a paragraph, a button.',
    demo: () =>
      demo(
        'cd-element',
        `<div class="cd-code"><span class="cd-part" style="--i:0">&lt;p&gt;</span><span class="cd-part" style="--i:1">Hello</span><span class="cd-part" style="--i:2">&lt;/p&gt;</span></div>
         ${cycle('9em', ['opening tag', 'the content', 'closing tag'])}`,
      ),
  },
  {
    id: 'attribute',
    title: 'Attribute',
    language: 'html',
    keywords: ['href', 'class', 'id', 'property'],
    summary:
      'An attribute adds extra information to a tag, written as name="value". It never shows up on the page by itself - it tells the browser something about the element.',
    demo: () =>
      demo(
        'cd-attribute',
        `<div class="cd-code">&lt;a <span class="cd-part" style="--i:0">href</span>=<span class="cd-part" style="--i:1">"/about"</span>&gt;</div>
         ${cycle('11em', ['the name', 'the value'])}`,
      ),
  },
  {
    id: 'nesting',
    title: 'Nesting',
    language: 'html',
    keywords: ['parent', 'child', 'tree', 'indent'],
    summary:
      'Elements live inside other elements. The one on the outside is the parent, the one inside is the child. That nesting is what gives a page its structure.',
    demo: () =>
      demo(
        'cd-nesting',
        `<div class="cd-nest" style="--i:0"><i>body</i>
           <div class="cd-nest" style="--i:1"><i>div</i>
             <div class="cd-nest" style="--i:2"><i>p</i></div>
           </div>
         </div>`,
      ),
  },

  // --- CSS -----------------------------------------------------------------
  {
    id: 'selector',
    title: 'Selector',
    language: 'css',
    keywords: ['class', 'id', 'match', 'rule'],
    summary:
      'A selector picks which elements a rule applies to. A plain name like p matches every paragraph; #title matches the one element with that id.',
    demo: () =>
      demo(
        'cd-selector',
        `<div class="cd-code">${cycle('3.6em', ['p', '#title'])} { color: grey }</div>
         <div class="cd-targets">
           <span class="cd-target cd-m-b">h1#title</span>
           <span class="cd-target cd-m-a">p</span>
           <span class="cd-target cd-m-a">p</span>
         </div>`,
      ),
  },
  {
    id: 'box-model',
    title: 'Box model',
    language: 'css',
    keywords: ['padding', 'margin', 'border', 'spacing'],
    summary:
      'Every element is a box in four layers. Padding is space inside the border, margin is space outside it. Growing the padding pushes the border outwards, not the content inwards.',
    demo: () =>
      demo(
        'cd-boxmodel',
        `<div class="cd-l cd-l-margin"><i>margin</i>
           <div class="cd-l cd-l-border"><i>border</i>
             <div class="cd-l cd-l-padding"><i>padding</i>
               <div class="cd-l cd-l-content">content</div>
             </div>
           </div>
         </div>`,
      ),
  },
  {
    id: 'flexbox',
    title: 'Flexbox',
    language: 'css',
    keywords: ['flex', 'row', 'layout', 'align', 'grow'],
    summary:
      'display: flex lays children out in a row and shares the leftover space between them. flex-grow decides who gets more of it: an item with grow 3 takes three times the spare space of an item with grow 1.',
    demo: () =>
      demo(
        'cd-flexbox',
        `<div class="cd-flex">
           <span>1</span><span class="cd-grow">grows</span><span>1</span>
         </div>
         <div class="cd-hint">flex-grow: 1 / <b>animating</b> / 1</div>`,
      ),
  },
  {
    id: 'transition',
    title: 'Transition',
    language: 'css',
    keywords: ['animation', 'ease', 'smooth', 'hover'],
    summary:
      'A transition tells the browser to move between two values over time instead of jumping. Same start, same end - only the trip is different.',
    demo: () =>
      demo(
        'cd-transition',
        `<div class="cd-track"><span class="cd-dot cd-jump"></span><em>without</em></div>
         <div class="cd-track"><span class="cd-dot cd-ease"></span><em>with transition</em></div>`,
      ),
  },

  // --- JavaScript ----------------------------------------------------------
  {
    id: 'variable',
    title: 'let and const',
    language: 'js',
    keywords: ['variable', 'value', 'assign', 'var'],
    summary:
      'A variable is a name for a value. let can be given a new value later; const keeps the one it started with, so reassigning it is an error.',
    demo: () =>
      demo(
        'cd-variable',
        `<div class="cd-var"><code>let count</code> ${cycle('2ch', ['0', '1', '2'])}</div>
         <div class="cd-var cd-locked"><code>const max</code> <b>10</b> <em>cannot be reassigned</em></div>`,
      ),
  },
  {
    id: 'function',
    title: 'Function',
    language: 'js',
    keywords: ['return', 'argument', 'parameter', 'call'],
    summary:
      'A function is a named piece of work. You hand it a value, it does something with it, and it hands a value back.',
    demo: () =>
      demo(
        'cd-function',
        `<div class="cd-pipe">
           <span class="cd-token cd-in">3</span>
           <span class="cd-fn">double(n)</span>
           <span class="cd-token cd-out">6</span>
         </div>`,
      ),
  },
  {
    id: 'event',
    title: 'Event listener',
    language: 'js',
    keywords: ['click', 'addEventListener', 'handler', 'interaction'],
    summary:
      'An event listener waits for something to happen - a click, a key, a scroll - and runs your function when it does. Nothing happens until the event fires.',
    demo: () =>
      demo(
        'cd-event',
        `<div class="cd-evt">
           <span class="cd-btn">Click me<i class="cd-ripple"></i></span>
           <span class="cd-wire"><i></i></span>
           <span class="cd-handler">your function runs</span>
         </div>`,
      ),
  },
  {
    id: 'loop',
    title: 'Loop',
    language: 'js',
    keywords: ['for', 'while', 'repeat', 'iterate', 'index'],
    summary:
      'A loop repeats the same block of code once per item. The counter starts at 0 and climbs until the list runs out.',
    demo: () =>
      demo(
        'cd-loop',
        `<div class="cd-cells"><span></span><span></span><span></span><span></span><b class="cd-marker"></b></div>
         ${cycle('5em', ['i = 0', 'i = 1', 'i = 2', 'i = 3'])}`,
      ),
  },
];

/**
 * Ranks concepts for a query. The active tab wins ties, so a beginner writing
 * CSS sees CSS concepts first without other languages disappearing entirely.
 */
export function search(query: string, language: LangId): Concept[] {
  const q = query.trim().toLowerCase();

  const scored = CONCEPTS.map((concept) => {
    const title = concept.title.toLowerCase();
    let score = -1;
    if (!q) score = 0;
    else if (concept.id.startsWith(q) || title.startsWith(q)) score = 3;
    else if (title.includes(q)) score = 2;
    else if (concept.keywords.some((word) => word.toLowerCase().startsWith(q))) score = 1;
    return { concept, score: score + (concept.language === language ? 0.5 : 0) };
  }).filter((entry) => entry.score >= 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.map((entry) => entry.concept);
}
