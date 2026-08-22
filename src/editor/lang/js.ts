/** JavaScript mode. Lazily imported the first time the JS tab is opened. */
import { parser } from '@lezer/javascript';
import { LRLanguage, delimitedIndent, flatIndent, indentNodeProp } from '@codemirror/language';
import type { Extension } from '@codemirror/state';

const language = LRLanguage.define({
  name: 'javascript',
  parser: parser.configure({
    props: [
      indentNodeProp.add({
        Block: delimitedIndent({ closing: '}' }),
        ObjectExpression: delimitedIndent({ closing: '}' }),
        ArrayExpression: delimitedIndent({ closing: ']' }),
        ArgList: delimitedIndent({ closing: ')' }),
        ParamList: delimitedIndent({ closing: ')' }),
        ClassBody: delimitedIndent({ closing: '}' }),
        SwitchBody: delimitedIndent({ closing: '}' }),
        BlockComment: () => null,
        TemplateString: flatIndent,
        Statement: (context) => context.column(context.node.from),
      }),
    ],
  }),
  languageData: {
    commentTokens: { line: '//', block: { open: '/*', close: '*/' } },
    indentOnInput: /^\s*(?:\}|\]|\)|else\b|case\b|default:)$/,
    closeBrackets: { stringPrefixes: [] },
  },
});

export const extension: Extension = language;
