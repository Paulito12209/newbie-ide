/** CSS mode. Lazily imported the first time the CSS tab is opened. */
import { parser } from '@lezer/css';
import { LRLanguage, continuedIndent, indentNodeProp } from '@codemirror/language';
import type { Extension } from '@codemirror/state';

const language = LRLanguage.define({
  name: 'css',
  parser: parser.configure({
    props: [indentNodeProp.add({ Declaration: continuedIndent() })],
  }),
  languageData: {
    commentTokens: { block: { open: '/*', close: '*/' } },
    indentOnInput: /^\s*\}$/,
    wordChars: '-',
  },
});

export const extension: Extension = language;
