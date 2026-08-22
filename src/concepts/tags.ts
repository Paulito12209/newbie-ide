/**
 * The tag palette behind the slash menu in HTML files.
 *
 * This exists for one reason: on a phone keyboard `<` and `>` sit two layers
 * deep, so writing markup by hand is genuinely hostile. It is not there to save
 * an experienced typist keystrokes - which is why every entry shows the markup
 * it inserts. You still see the angle brackets you did not have to type.
 *
 * `|` marks where the caret lands. It always sits between the tags, so you can
 * start typing the content straight away; void elements put it after.
 */
export interface TagEntry {
  /** What you type after the slash. */
  id: string;
  /** What the row shows; a tag can appear more than once with variants. */
  label: string;
  snippet: string;
  summary: string;
}

interface TagSpec {
  id: string;
  snippet: string;
  summary: string;
  /** Also offer a `class=""` variant, for the tags people actually style. */
  classable?: boolean;
}

const SPECS: readonly TagSpec[] = [
  { id: 'h1', snippet: '<h1>|</h1>', summary: 'Main heading of the page', classable: true },
  { id: 'h2', snippet: '<h2>|</h2>', summary: 'Section heading', classable: true },
  { id: 'h3', snippet: '<h3>|</h3>', summary: 'Sub-section heading', classable: true },
  { id: 'h4', snippet: '<h4>|</h4>', summary: 'Fourth-level heading', classable: true },
  { id: 'h5', snippet: '<h5>|</h5>', summary: 'Fifth-level heading', classable: true },
  { id: 'h6', snippet: '<h6>|</h6>', summary: 'Sixth-level heading', classable: true },
  { id: 'p', snippet: '<p>|</p>', summary: 'Paragraph of text', classable: true },
  { id: 'div', snippet: '<div>|</div>', summary: 'Generic box, for grouping and styling', classable: true },
  { id: 'span', snippet: '<span>|</span>', summary: 'Generic piece of inline text', classable: true },
  { id: 'a', snippet: '<a href="">|</a>', summary: 'Link to another page', classable: true },
  { id: 'button', snippet: '<button>|</button>', summary: 'Something to click', classable: true },
  { id: 'ul', snippet: '<ul>\n  <li>|</li>\n</ul>', summary: 'Bulleted list', classable: true },
  { id: 'ol', snippet: '<ol>\n  <li>|</li>\n</ol>', summary: 'Numbered list', classable: true },
  { id: 'li', snippet: '<li>|</li>', summary: 'One item in a list', classable: true },
  { id: 'img', snippet: '<img src="" alt="">|', summary: 'Image', classable: true },
  { id: 'strong', snippet: '<strong>|</strong>', summary: 'Important text, shown bold' },
  { id: 'em', snippet: '<em>|</em>', summary: 'Emphasised text, shown italic' },
  { id: 'br', snippet: '<br>|', summary: 'Line break' },
  { id: 'section', snippet: '<section>|</section>', summary: 'A section of the page', classable: true },
  { id: 'header', snippet: '<header>|</header>', summary: 'Top of the page or a section', classable: true },
  { id: 'footer', snippet: '<footer>|</footer>', summary: 'Bottom of the page or a section', classable: true },
  { id: 'nav', snippet: '<nav>|</nav>', summary: 'Group of navigation links', classable: true },
  { id: 'main', snippet: '<main>|</main>', summary: 'The main content of the page', classable: true },
  { id: 'form', snippet: '<form>|</form>', summary: 'Group of inputs to submit', classable: true },
  { id: 'input', snippet: '<input type="text">|', summary: 'Text field', classable: true },
  { id: 'label', snippet: '<label>|</label>', summary: 'Caption for an input', classable: true },
];

/**
 * A plain entry per tag, plus a `class=""` variant for the ones worth styling.
 * The variant puts the caret in the class value, because that is the part you
 * came to fill in.
 */
function withVariants(specs: readonly TagSpec[]): TagEntry[] {
  const entries: TagEntry[] = [];
  for (const spec of specs) {
    entries.push({ id: spec.id, label: spec.id, snippet: spec.snippet, summary: spec.summary });
    if (!spec.classable) continue;
    // Append the attribute at the end of the open tag, so `a` keeps href first,
    // then move the caret into the class value.
    const openTagEnd = spec.snippet.indexOf('>');
    const withClass = spec.snippet.slice(0, openTagEnd) + ' class="|"' + spec.snippet.slice(openTagEnd);
    const caret = withClass.indexOf('|');
    entries.push({
      id: spec.id,
      label: `${spec.id} class`,
      snippet: withClass.slice(0, caret + 1) + withClass.slice(caret + 1).replace('|', ''),
      summary: `${spec.summary}, with a class to style it`,
    });
  }
  return entries;
}

export const TAGS: readonly TagEntry[] = withVariants(SPECS);

/** The markup as it will appear, without the caret marker. */
export function preview(entry: TagEntry): string {
  return entry.snippet.replace('|', '').replace(/\n\s*/g, ' ');
}

/**
 * Expands a snippet at a given indent. Returns the text to insert and where the
 * caret goes inside it. Shared with the layout templates.
 */
export function expand(snippet: string, indent: string): { text: string; caret: number } {
  const lines = snippet.split('\n');
  const text = lines.map((line, i) => (i === 0 ? line : indent + line)).join('\n');
  const caret = text.indexOf('|');
  return { text: text.replace('|', ''), caret: caret === -1 ? text.length : caret };
}
