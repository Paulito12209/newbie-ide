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
  snippet: string;
  summary: string;
}

export const TAGS: readonly TagEntry[] = [
  { id: 'h1', snippet: '<h1>|</h1>', summary: 'Main heading of the page' },
  { id: 'h2', snippet: '<h2>|</h2>', summary: 'Section heading' },
  { id: 'h3', snippet: '<h3>|</h3>', summary: 'Sub-section heading' },
  { id: 'h4', snippet: '<h4>|</h4>', summary: 'Fourth-level heading' },
  { id: 'h5', snippet: '<h5>|</h5>', summary: 'Fifth-level heading' },
  { id: 'h6', snippet: '<h6>|</h6>', summary: 'Sixth-level heading' },
  { id: 'p', snippet: '<p>|</p>', summary: 'Paragraph of text' },
  { id: 'div', snippet: '<div>|</div>', summary: 'Generic box, for grouping and styling' },
  { id: 'span', snippet: '<span>|</span>', summary: 'Generic piece of inline text' },
  { id: 'a', snippet: '<a href="">|</a>', summary: 'Link to another page' },
  { id: 'button', snippet: '<button>|</button>', summary: 'Something to click' },
  { id: 'ul', snippet: '<ul>\n  <li>|</li>\n</ul>', summary: 'Bulleted list' },
  { id: 'ol', snippet: '<ol>\n  <li>|</li>\n</ol>', summary: 'Numbered list' },
  { id: 'li', snippet: '<li>|</li>', summary: 'One item in a list' },
  { id: 'img', snippet: '<img src="" alt="">|', summary: 'Image' },
  { id: 'strong', snippet: '<strong>|</strong>', summary: 'Important text, shown bold' },
  { id: 'em', snippet: '<em>|</em>', summary: 'Emphasised text, shown italic' },
  { id: 'br', snippet: '<br>|', summary: 'Line break' },
  { id: 'section', snippet: '<section>|</section>', summary: 'A section of the page' },
  { id: 'header', snippet: '<header>|</header>', summary: 'Top of the page or a section' },
  { id: 'footer', snippet: '<footer>|</footer>', summary: 'Bottom of the page or a section' },
  { id: 'nav', snippet: '<nav>|</nav>', summary: 'Group of navigation links' },
  { id: 'main', snippet: '<main>|</main>', summary: 'The main content of the page' },
  { id: 'form', snippet: '<form>|</form>', summary: 'Group of inputs to submit' },
  { id: 'input', snippet: '<input type="text">|', summary: 'Text field' },
  { id: 'label', snippet: '<label>|</label>', summary: 'Caption for an input' },
];

/** The markup as it will appear, without the caret marker. */
export function preview(entry: TagEntry): string {
  return entry.snippet.replace('|', '').replace(/\n\s*/g, ' ');
}

/**
 * Expands a snippet at a given indent. Returns the text to insert and where the
 * caret goes inside it.
 */
export function expand(entry: TagEntry, indent: string): { text: string; caret: number } {
  const lines = entry.snippet.split('\n');
  const text = lines.map((line, i) => (i === 0 ? line : indent + line)).join('\n');
  const caret = text.indexOf('|');
  return { text: text.replace('|', ''), caret: caret === -1 ? text.length : caret };
}
