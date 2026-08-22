/**
 * Layout templates: columns and cards, Notion-style.
 *
 * Picking one writes the markup into the page **and the CSS into the
 * stylesheet** - into the real file, where it is visible and editable. Nothing
 * runs behind the scenes; if you delete the rules, the layout stops working,
 * exactly as it would anywhere else.
 *
 * The CSS is deliberately tiny and shared: one base rule per family plus one
 * line per column count.
 */
export interface CssBlock {
  /** Substring that proves the block is already in the file. */
  test: string;
  text: string;
}

export interface LayoutEntry {
  id: string;
  label: string;
  summary: string;
  keywords: readonly string[];
  /** `|` marks where the caret lands. */
  html: string;
  css: readonly CssBlock[];
}

/**
 * Written the way it is taught, not the way it is shortest: a class on each
 * child instead of `> *` or `* + *`, and :first-child to drop the divider on
 * the one that does not need it. Every selector here is one you can look up.
 */
const COLUMNS_FLEX: CssBlock = {
  test: '.columns {',
  text: [
    '.columns {',
    '  display: flex;',
    '  gap: 16px;',
    '}',
    '',
    '.column {',
    '  flex: 1;',
    '  padding-left: 16px;',
    '  border-left: 1px solid #e0e0e0;',
    '}',
    '',
    '.column:first-child {',
    '  padding-left: 0;',
    '  border-left: none;',
    '}',
  ].join('\n'),
};

const CARDS_FLEX: CssBlock = {
  test: '.cards {',
  text: [
    '.cards {',
    '  display: flex;',
    '  gap: 16px;',
    '}',
    '',
    '.card {',
    '  flex: 1;',
    '  padding: 16px;',
    '  border: 1px solid #e0e0e0;',
    '  border-radius: 8px;',
    '}',
  ].join('\n'),
};

const COLUMNS_GRID: CssBlock = {
  test: '.columns {',
  text: [
    '.columns {',
    '  display: grid;',
    '  gap: 16px;',
    '}',
    '',
    '.column {',
    '  padding-left: 16px;',
    '  border-left: 1px solid #e0e0e0;',
    '}',
    '',
    '.column:first-child {',
    '  padding-left: 0;',
    '  border-left: none;',
    '}',
  ].join('\n'),
};

const CARDS_GRID: CssBlock = {
  test: '.cards {',
  text: [
    '.cards {',
    '  display: grid;',
    '  gap: 16px;',
    '}',
    '',
    '.card {',
    '  padding: 16px;',
    '  border: 1px solid #e0e0e0;',
    '  border-radius: 8px;',
    '}',
  ].join('\n'),
};

const track = (selector: string, count: number): CssBlock => ({
  test: `${selector} {`,
  text: [`${selector} {`, `  grid-template-columns: repeat(${count}, 1fr);`, '}'].join('\n'),
});

/** Each child carries its own class, so the CSS can name it directly. */
function children(kind: 'column' | 'card', count: number, indent = '  '): string {
  return Array.from(
    { length: count },
    (_, i) => `${indent}<div class="${kind}">${i === 0 ? '|' : ''}</div>`,
  ).join('\n');
}

function family(kind: 'columns' | 'cards', count: number, useGrid: boolean): LayoutEntry {
  const flexBase = kind === 'columns' ? COLUMNS_FLEX : CARDS_FLEX;
  const gridBase = kind === 'columns' ? COLUMNS_GRID : CARDS_GRID;
  const summary =
    kind === 'columns'
      ? `${count} columns side by side, divided by a hairline`
      : `${count} bordered cards in a row`;
  const words =
    kind === 'columns'
      ? [`${count}col`, `col${count}`, 'columns', 'col', 'layout', 'spalten']
      : [`${count}card`, `card${count}`, 'cards', 'card', 'box', 'karten'];

  return {
    id: `${kind}-${count}`,
    label: `${count} ${kind}`,
    summary,
    keywords: [...words, `${count}`, 'grid', 'flex'],
    // Grid needs a rule per column count; flexbox does not, so the class does
    // not need the count either.
    html: `<div class="${kind}${useGrid ? ` ${kind}-${count}` : ''}">\n${children(kind === 'columns' ? 'column' : 'card', count)}\n</div>`,
    css: useGrid ? [gridBase, track(`.${kind}-${count}`, count)] : [flexBase],
  };
}

/** Built per call, because the grid rule can change between one use and the next. */
export function layouts(useGrid: boolean): readonly LayoutEntry[] {
  return [
    family('columns', 2, useGrid),
    family('columns', 3, useGrid),
    family('columns', 4, useGrid),
    family('columns', 5, useGrid),
    family('cards', 2, useGrid),
    family('cards', 3, useGrid),
    family('cards', 4, useGrid),
  ];
}

/** The markup as one line, for the row preview. */
export function preview(entry: LayoutEntry): string {
  return entry.html.replace('|', '').replace(/\n\s*/g, ' ');
}
