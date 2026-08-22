# Slashlearn MVP

A minimal browser-based code editor with live preview. HTML, CSS and JS tabs on
the left, a sandboxed preview on the right, a draggable splitter between them.

Static site, no backend, no build-time server, no desktop wrapper. Visual design
is out of scope: black, white, grey, system font.

## Quick start

```bash
npm install && npm run dev
```

`npm run build` typechecks and builds to `dist/`. `npm run preview` serves the
build. `npm run size` prints the measured bundle table below.

## Measured bundle size

Produced by `npm run build && npm run size` (gzip level 9):

```
  332.93 KB raw    108.45 KB gzip  initial  assets/index-*.js
   76.43 KB raw     30.19 KB gzip  lazy     assets/js-*.js
   16.92 KB raw      8.01 KB gzip  lazy     assets/css-*.js
    8.42 KB raw      3.28 KB gzip  lazy     assets/concepts-*.js
    7.03 KB raw      1.96 KB gzip  lazy     assets/concepts-*.css
    2.39 KB raw      1.01 KB gzip  initial  assets/index-*.css
    0.90 KB raw      0.44 KB gzip  initial  index.html
----------------------------------------------------------------
initial (cold load): 109.89 KB gzip
lazy (on demand):     43.44 KB gzip
total:               153.33 KB gzip
```

**153.33 KB gzipped total**, of which **109.89 KB** is fetched on cold load.
Budget was 400 KB.

## The two preview paths

This is the core of the build. A change to CSS and a change to HTML or JS reach
the iframe by completely different routes.

### CSS: hot patch, no reload

The preview document contains a persistent `<style id="user-css">` element. On a
CSS edit the parent sends the new stylesheet through `postMessage`, and the
runtime inside the iframe assigns it to `styleEl.textContent`. The document is
never rewritten, so scroll position, focus, JS state, timers and running CSS
animations all survive the edit. Coalesced to one `requestAnimationFrame`, never
debounced beyond that.

Measured, typing character by character into the CSS tab (57 samples, from the
input event to the frame that dispatches the patch): **median 2.7 ms, p95 8.8 ms,
max 9.9 ms**, zero samples above 100 ms, and zero `srcdoc` writes across the
whole burst.

### HTML / JS: full rebuild

Structure and behaviour cannot be swapped into a live document, so a fresh
document is written via `srcdoc`. This resets the preview by definition, which is
why it is debounced at **250 ms** of typing inactivity: it happens between
keystrokes, never during a burst. Measured: 24 characters typed over 543 ms
produced **0 rebuilds while typing and exactly 1 afterwards**.

The rebuilt document already carries the current CSS, so a rebuild never flashes
unstyled content and never needs a follow-up patch.

### Keeping typing at 60 fps

No preview work happens synchronously in the CodeMirror update listener. The
listener records the new `Text` object and arms a timer, nothing more.
Stringifying a document is O(document), so even `doc.toString()` is deferred to
the frame or idle callback that needs it. `localStorage` writes go through
`requestIdleCallback` (with a synchronous flush on `pagehide`).

## Cold load

Production build over localhost: **first contentful paint 72 ms, load event
122 ms**. The CSS and JS grammars are separate chunks, not preloaded, requested
from an idle callback after the `load` event, and measured starting at 129 ms:
strictly after first paint. Only the HTML mode is in the entry chunk.

## Mobile layout

Under 768px the two panes stop sharing the screen and ride a sliding track
instead. The editor takes the whole viewport except a **24px strip on the right,
where the edge of the live preview stays visible** - so the output is never out
of sight, just out of the way.

That strip is also the control:

- **tap** it to switch panes,
- **swipe** it right-to-left to pull the preview in (the track follows your
  finger, and a flick counts even if it is short),
- **drag** it back, or tap the matching 24px of editor that now peeks on the
  left. The layout is symmetric, so the way back is always in the same place.

A drag that stops short of halfway snaps back where it came from; an interrupted
gesture (a call, a system swipe) settles on the pane it started from rather than
stranding the track mid-slide. Keyboard: the strip is focusable, ArrowLeft shows
the preview, ArrowRight the editor, Enter toggles.

The desktop splitter and the mobile pane switcher are two different interactions
sharing one DOM element, and only one is attached at a time - the layout switch
detaches the other cleanly, including mid-drag. Nothing on mobile resizes
anything; nothing on desktop slides.

## Error handling

`window.onerror` and `unhandledrejection` are caught inside the iframe and
forwarded to the parent, which shows them in the status bar under the preview.
Reported line numbers are remapped to the JS tab's own coordinates (the runtime
subtracts the document offset), so a broken line 2 reads `script.js:2:5` rather
than a line number from the generated document. A syntax error leaves HTML and
CSS rendering normally and never touches the editor.

## Architecture

```
src/
  main.ts              wiring + the scheduler that picks hot path vs rebuild
  state.ts             module-scope state, localStorage persistence
  concepts/
    slash-menu.ts      the `/` menu; a plain consumer of the hook below
    catalog.ts         the concepts and their animated demos
    concepts.css       menu, card and every demo animation
  editor/
    editor.ts          CodeMirror setup; one EditorState per tab
    concept-hook.ts    extension point for the concept-teaching layer
    close-brackets.ts  minimal auto-closing brackets
    languages.ts       mode registry, lazy loading, prefetch
    lang/{html,css,js}.ts
    theme.ts           plain light theme + highlight style
  preview/
    bridge.ts          the only module that talks to the iframe
    runtime.ts         the script that runs inside the iframe
  ui/
    tabs.ts  splitter.ts  mobile.ts  status.ts
```

The editor knows nothing about the preview, and the preview knows nothing about
the editor. `main.ts` is the only place they meet.

### The concept extension point

`src/editor/concept-hook.ts` is the seam between the editor and the teaching
layer. The editor offers exactly three things through it - cursor context, a
place to render DOM, and a channel for the five navigation keys an inline UI
needs - and knows nothing else about concepts.

```ts
import { registerConceptProvider } from './editor/concept-hook';

const off = registerConceptProvider({
  id: 'my-concept',
  render(ctx) {
    // ctx: { language, pos, line: {number, from, to, text}, column,
    //        selectionEmpty, hasFocus, replaceRange }
    if (!ctx.line.text.includes('<h1')) return null;
    const dom = document.createElement('span');
    dom.textContent = ' [heading]';
    return { dom, placement: 'inline', key: 'heading-' + ctx.line.number };
  },
  // optional, only called for ArrowUp/ArrowDown/Enter/Tab/Escape
  handleKey(key, ctx) {
    return false; // false = the editor keeps its normal behaviour
  },
});
```

Guarantees the host makes: providers run at most once per animation frame and
never inside the CodeMirror update cycle; returning `null` renders nothing;
widgets sharing a `key` are not remounted, so a running animation survives
typing; a provider that throws is logged and isolated rather than breaking the
editor; and `handleKey` sits above the default keymap but only consumes a key
while the provider says so, so ordinary Enter and arrow keys are untouched.

`ctx.replaceRange` is the only way a concept can change the document, and it
exists for exactly one purpose: letting a provider clean up its own trigger
text. The teaching layer explains code, it does not write code.

## The slash menu

Type `/` in any tab. A menu opens at the cursor, filters as you keep typing,
and Enter opens a short explanation with a small animated demo. Arrow keys move,
Escape dismisses, and moving the cursor to another line puts the card away.

`/` only triggers at the start of a line or after a space, so `</div>`,
`//comment` and `a / b` never open it.

Eleven concepts ship today - element, attribute, nesting (HTML); selector, box
model, flexbox, transition (CSS); let/const, function, event listener, loop
(JS). Results from the active tab rank first, but the other languages stay
visible: a beginner in the CSS tab who searches for "loop" still finds it.

Adding a concept means adding one entry to `src/concepts/catalog.ts`. Every
demo animates in pure CSS, so an open card runs no script and no timer, and
`prefers-reduced-motion` collapses each one to its first frame.

**This is not autocompletion.** Choosing an entry inserts nothing. It removes
the `/query` you typed - which was never valid code - and opens an explanation.
One consequence worth knowing: while the prompt is on screen the `/query` really
is in your document, so an HTML or JS preview rebuild will show it (or, in the
JS tab, report it as a syntax error) until you pick a concept or delete it.

The whole layer is a separate chunk (3.29 KB JS + 1.96 KB CSS gzipped), imported
after the editor is up, so it stays off the cold-load path.

## Deliberately absent

No autocompletion, no IntelliSense, no AI suggestions, no snippet expansion.
Nothing in this editor ever writes code for you - the slash menu included.
`@codemirror/autocomplete` is **not in the dependency tree at all** - verify with
`npm ls @codemirror/autocomplete`.

Two decisions follow from that, and both are departures worth stating:

1. **Grammars come from `@lezer/html`, `@lezer/css` and `@lezer/javascript`
   directly, not from the `@codemirror/lang-*` wrappers.** Every `lang-*` package
   depends on `@codemirror/autocomplete` to ship its completion sources. Using the
   Lezer parsers directly keeps that package out of the tree entirely and drops
   the wrapper weight; the grammars carry their own highlighting props, so
   highlighting is unaffected. The wrappers' indentation props are reimplemented
   in `src/editor/lang/*.ts`.
2. **Auto-closing brackets are implemented locally** (`close-brackets.ts`, ~80
   lines) because upstream `closeBrackets` also lives in `@codemirror/autocomplete`.
   It handles pair insertion, wrapping a selection, typing over a closer, and
   backspacing an empty pair - and it does not auto-close a quote after a word
   character, so `don't` stays `don't`.

Also worth flagging: line wrapping is on (long lines are hostile to beginners),
and syntax highlighting uses a small muted palette rather than pure greyscale,
since token colour is functional rather than decorative.

## Stack

Vite + TypeScript (strict, ESM only, `esnext` target, no legacy polyfills),
CodeMirror 6, a `sandbox="allow-scripts"` iframe, CSS Grid with a pointer-events
splitter, and plain module-scope state. No UI framework, no state library, no
split-pane library, no in-browser bundler.
