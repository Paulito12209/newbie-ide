/** HTML mode. Statically imported: it is the tab shown on first paint. */
import { parser } from '@lezer/html';
import { LRLanguage, indentNodeProp } from '@codemirror/language';
import type { Extension } from '@codemirror/state';

const language = LRLanguage.define({
  name: 'html',
  parser: parser.configure({
    props: [
      indentNodeProp.add({
        Element(context) {
          const after = /^(\s*)(<\/)?/.exec(context.textAfter)!;
          if (context.node.to <= context.pos + after[0].length) return context.continue();
          return context.lineIndent(context.node.from) + (after[2] ? 0 : context.unit);
        },
        'OpenTag CloseTag SelfClosingTag': (context) => context.column(context.node.from) + context.unit,
      }),
    ],
  }),
  languageData: {
    commentTokens: { block: { open: '<!--', close: '-->' } },
    indentOnInput: /^\s*<\/\w+\W$/,
  },
});

export const extension: Extension = language;
