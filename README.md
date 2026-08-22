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

## Deploy

Static output, no backend, no runtime - any static host works. `vercel.json`
pins the Vite preset, `npm run build` and `dist/`, and sets immutable caching on
the hashed files in `/assets`.

On Vercel: import the repository at vercel.com/new and deploy. Nothing to
configure - the root of the repo is the project root, and there are no
environment variables. Pushes to `main` deploy automatically after that, and
branches get preview URLs.

## Measured bundle size

Produced by `npm run build && npm run size` (gzip level 9):

```
initial (cold load): 113.76 KB gzip
lazy (on demand):     44.46 KB gzip
total:               158.22 KB gzip
```

Run `npm run size` for the per-file breakdown.

**158.22 KB gzipped total**, of which **113.76 KB** is fetched on cold load.
Budget was 400 KB.

## Files

A file list, not three fixed slots. `+` at the end of the file bar creates one,
tapping the file you are already in renames it, and the rename dialog is also
where you delete it. Names must end in `.html`, `.css` or `.js` - that extension
is the only thing that decides how a file is treated. No folders yet.

**Nothing is wired up implicitly.** A stylesheet applies because the HTML links
it, and a script runs because the HTML loads it:

```html
<link rel="stylesheet" href="style.css">
<script src="script.js"></script>
```

The preview resolves those references against the open files by name, exactly as
a browser resolves them against a server. Delete the `<link>` and the styling
stops. Point it at a file that does not exist and it stays a dead link. That is
the point: a beginner has to learn that CSS does not attach itself, and an editor
that quietly injects it teaches the opposite.

`index.html` is the page (or the first `.html` file, if it is named something
else). Resolution happens through `DOMParser`, so it is real HTML parsing rather
than a regex over the source.

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

## Menu bar and theming

**Desktop only** - 44px, well inside the 64px ceiling. App name on the left, an
actions group on the right; today that group holds the theme control and it is
where later actions go. Mobile has no top bar at all and reaches the same
control through the options button in the bottom file bar.

The theme button cycles **Auto - Light - Dark**. Auto stamps nothing on the
document and lets `prefers-color-scheme` decide; the other two set `data-theme`
on `<html>` and win over the system setting in both directions. The choice is
part of the saved session.

Every colour in the app is a CSS custom property, so the switch is one attribute
change - no second theme object, no CodeMirror `Compartment`, no reconfiguring
live editor states. The editor theme and highlight style resolve `var(--syn-*)`,
and the slash menu, concept cards and their animated demos read the same tokens.
An inline script in `index.html` applies a stored choice before first paint, so
picking dark on a light system never flashes white on reload.

Contrast was measured rather than eyeballed, in both themes: every syntax token,
the line-number gutter, the status bar and inactive tabs clear WCAG AA (4.5:1).
The worst case is 4.61:1 (comments, light). Two colours were adjusted after
measuring - the gutter sat at 2.73:1 light and 3.44:1 dark, and light comments at
3.46:1.

The preview iframe stays white in both themes. It shows the user's own page, and
an unstyled page really is white - tinting it would misreport their CSS. On
mobile that means the 24px peek strip is a white sliver against dark chrome,
which is the honest reading of "your page is over there".

## Mobile layout

Below 768px the layout is a different thing, not a squeezed version of the
desktop one.

- **No bar along the top.** The whole viewport is the pane.
- **The file bar sits at the bottom**, as a dark strip floating over the code
  rather than a hard divider - the editor scrolls underneath it and keeps a
  matching bottom inset so the last line is never trapped behind it. It is dark
  in both themes on purpose: it reads as chrome above the content.
- **One pane at a time**, switched by a floating button above the file bar. Its
  icon is the destination: a monitor while you are in the code, angle brackets
  once you are looking at the page.
- **The panel button** at the end of the file bar opens a drawer over three
  quarters of the screen from the right, listing the files top to bottom. It
  also holds "New file" and the theme control, since there is no top bar to put
  them in. It closes on a tap outside, on its own Close button, or on Escape -
  `showModal()` only gives you the last of those, and a phone has no Escape key.

The pane slide is `translateX(-100%)` on both panes, so the geometry is pure CSS
with no pixel maths in JavaScript.

### The floating button inverts

It is the one element that does not join the dark chrome, because it has to stay
visible against whatever is behind it - and what is behind it is not always the
theme background:

| | behind it | button |
|---|---|---|
| Code, light | white page | dark, light icon |
| Code, dark | dark editor | **light, dark icon** |
| Display, either theme | the user's page, which is white | dark, light icon |

So it flips with the theme over the editor, and stays dark over the preview.
Measured contrast against the surface behind it is 13.97:1 at worst.

### iOS zoom

Two different causes, two different fixes:

- **Double-tap zoom** fired when tapping file tabs in quick succession. Every
  control carries `touch-action: manipulation`, which removes the double-tap
  gesture without touching pinch zoom.
- **Focus zoom** fired on the rename dialog: iOS zooms the viewport whenever a
  text field smaller than 16px takes focus, and does not zoom back out. That
  input is pinned to 16px.

Pinch zoom is left alone - `user-scalable=no` would have fixed both in one line
and taken accessibility with it.

## Editable slots

Landing a caret between `""`, or between `>` and `</`, is a two-pixel target.
Every position the language actually lets you type into is marked, and each one
carries a hit area far larger than what it draws:

- an **empty** slot becomes a small round chip; tapping it puts the caret inside
- a **filled** slot gets a quiet pill around the value; tapping it **selects the
  whole value**, so the next keystroke replaces it

That second case is the one precision-tapping never solved: changing a value
afterwards used to mean placing a caret and then dragging a selection over it.

Positions come from the syntax tree rather than a regex, so a slot is only
offered where the language really has one - never inside a comment, or a string
that happens to look like markup. Today: HTML attribute values and text content,
CSS declaration values, JS string contents. `<script>` and `<style>` bodies are
excluded, since their content is another language rather than a value.

The chip is 8px, but its hit area is 22px tall and reaches 5px past each side.
That gap is the point: the mark stays small enough to read as code, while the
thing your thumb has to hit is not.

## Line actions

One dots button, 40px past the end of a single line - the line you are working
on. Which line that is depends on how you are pointing: **on mobile it follows
the caret**, because the active line is the one you are in and there is no hover
on a touch screen; **on desktop it follows the mouse**, because hovering is how
you say "this line" without clicking into it. Blank lines get nothing.

It opens three actions:

- **Copy line** - the line without its indentation
- **Delete line** - takes the line break with it, so no blank line is left
- **Clone line** - a count with chevron steppers either side of it and an
  `+ Add` button. The traffic-light case: you want the same element three times
  and typing it out on a phone is the whole problem.

The steppers sit side by side rather than stacked, because a stacked spinner
gives each arrow about 17px of height, which is not a touch target. The count
input is 16px for the same iOS reason as the rename dialog.

## Typing with a keyboard up

Two things go wrong on a phone the moment the on-screen keyboard appears: the
line you are typing on ends up underneath it, and the slash menu opens downwards
into a region that no longer exists.

- The shell is sized to `visualViewport`, so the layout knows how much room is
  actually left. The file bar and the floating switch hide while the keyboard is
  up - they were competing with the code for the few lines that remain.
- CodeMirror gets a `scrollMargins` bottom of one line, so the caret is never
  the last visible line; there is always a line of context under it.
- The slash menu measures the room above and below the cursor and flips upwards
  when there is more room there, growing toward the top of the screen. Measured
  with the caret on the last line of a 640px window: the menu occupied 72-620px,
  entirely inside the pane.

## Touch gestures

A **double tap selects the word or value** under your finger, so the next
keystroke replaces it.

Single tap is deliberately left alone: it is also how you place the caret, so
copying or selecting on every tap would fire at you constantly. Line-level
actions live in the dots menu rather than in a hidden gesture - a gesture you
have to discover is worse than a button you can see.

## Layout templates

`/3col`, `/2cards` and friends drop a column or card layout into the page - and
write the CSS **into the stylesheet**, into the file you can see and edit. If you
delete the rules, the layout stops working, exactly as it would anywhere else.
Nothing is applied invisibly.

The CSS is written the way it is taught, not the way it is shortest. A class on
each child rather than `> *` or `* + *`, and `:first-child` to drop the divider
on the one that does not need it - every selector is one you can look up:

```css
.columns {
  display: flex;
  gap: 16px;
}

.column {
  flex: 1;
  padding-left: 16px;
  border-left: 1px solid #e0e0e0;
}

.column:first-child {
  padding-left: 0;
  border-left: none;
}
```

One block per family, reused by every count: with flexbox `flex: 1` divides the
row however many children there are, so a second template of the same family
adds nothing. Cards get a border and a radius instead of the divider. Turning
the grid rule on switches both families to CSS grid, which then does need a rule
per column count.

## Rules

Everything the editor could reach for starts **locked**, and the drawer's
Settings screen is where you widen it. Each rule changes what the tool actually
writes, never just a label:

| Rule | Off (default) | On |
|---|---|---|
| CSS Grid | templates write flexbox | templates write grid, with a rule per count |
| addEventListener | examples use `button.onclick = function () {}` | examples use `addEventListener` |

That is the seam the teaching layer grows into: a catalogue entry can ask
whether a rule is unlocked, and the menu, the templates and the concept cards
all read the same answer.

## Missing closers

Delete half of a pair by accident and the closer you still owe appears greyed
out at the right edge of the line. Tap it and it lands at the caret - `>`, `}`
and `"` are two keyboard layers deep on a phone, which is the whole reason.

The scan runs from the start of the file to the caret rather than over the
current line: a `{` is usually opened a line or two above the one you are typing
on, and a per-line scan misses exactly that case.

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
    tags.ts            the HTML tag palette
    layouts.ts         column and card templates
    workspace.ts       the one door into the project files
    concepts.css       menu, card and every demo animation
  editor/
    editor.ts          CodeMirror setup; one EditorState per tab
    concept-hook.ts    extension point for the concept-teaching layer
    close-brackets.ts  minimal auto-closing brackets
    slots.ts           tappable targets at editable positions
    line-menu.ts       the dots at the end of the current line
    missing-closers.ts the closers you still owe, parked on the right
    touch-gestures.ts  double tap to select a word
    languages.ts       mode registry, lazy loading, prefetch
    lang/{html,css,js}.ts
    theme.ts           plain light theme + highlight style
  preview/
    bridge.ts          the only module that talks to the iframe
    runtime.ts         the script that runs inside the iframe
  ui/
    tabs.ts  drawer.ts  dialog.ts  line-actions.ts  icons.ts
    keyboard.ts  toast.ts  clipboard.ts  settings.ts  menubar.ts  theme.ts
    splitter.ts  mobile.ts  status.ts
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

Type `/` in any tab. The menu opens at the cursor, filters as you keep typing,
and Enter uses the selected entry. Arrow keys move, Escape dismisses.

`/` only triggers at the start of a line or after a space, so `</div>`,
`//comment` and `a / b` never open it.

Two kinds of entry share the list.

### Tags (HTML files)

Picking one inserts the markup and leaves the caret between the tags, so you can
type the content straight away:

```
</p>          <- caret here, press Enter
    /h1       <- the prompt opens by itself
    <h1>|</h1>  <- pick h1
```

Pressing Enter **directly after a closing tag** opens the next line already
prompting. Anywhere else Enter is just Enter - mid-line or inside an attribute a
new element makes no sense, and a prompt you did not ask for is worse than one
keystroke. Escape on a prompt you did not type removes it again.

26 tags: `h1`-`h6`, `p`, `div`, `span`, `a`, `button`, `ul`, `ol`, `li`, `img`,
`strong`, `em`, `br`, `section`, `header`, `footer`, `nav`, `main`, `form`,
`input`, `label`. Most of them appear twice - `/div` offers both `<div></div>`
and `<div class=""></div>`, and the variant drops the caret in the class value,
because that is the part you came to fill in.

This is snippet insertion, which the brief originally ruled out, and it is here
for one reason: on a phone keyboard `<` and `>` sit two layers deep, so writing
markup by hand is an input problem rather than a typing-speed one. The
compromise is that **every row shows the markup it will insert** - the brackets
you did not type are still the brackets you see.

### Concepts

Concepts insert nothing. Enter opens a short explanation with a small animated
demo, and moving the cursor to another line puts it away.

Eleven ship today - element, attribute, nesting (HTML); selector, box model,
flexbox, transition (CSS); let/const, function, event listener, loop (JS).
Entries from the active language rank first, but the others stay reachable: a
beginner in the CSS tab who searches for "loop" still finds it.

Adding either kind means adding one entry to `catalog.ts` or `tags.ts`. Every
demo animates in pure CSS, so an open card runs no script and no timer, and
`prefers-reduced-motion` collapses each one to its first frame.

The whole layer is a separate chunk, imported after the editor is up, so it
stays off the cold-load path.

## Deliberately absent

No autocompletion, no IntelliSense, no AI suggestions. Nothing completes as you
type, ever.

The one deliberate exception is the tag half of the slash menu, described above:
it is invoked explicitly, it shows the markup it inserts, and it exists because
angle brackets are hard to reach on a phone - not to make typing faster.
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
