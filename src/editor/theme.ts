/**
 * Plain light theme. The app chrome is strictly black/white/grey; syntax
 * highlighting keeps a small muted palette because token colour is functional
 * here, not decorative: a beginner needs to see that a string is a string.
 */
import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import type { Extension } from '@codemirror/state';

const base = EditorView.theme(
  {
    '&': {
      color: '#111',
      backgroundColor: '#fff',
      fontSize: '13px',
    },
    '.cm-content': {
      fontFamily: 'var(--font-mono)',
      padding: '8px 0',
      caretColor: '#111',
    },
    '.cm-scroller': { lineHeight: '1.5', fontFamily: 'var(--font-mono)' },
    '.cm-gutters': {
      backgroundColor: '#fafafa',
      color: '#999',
      border: 'none',
      borderRight: '1px solid #eee',
    },
    '.cm-activeLineGutter': { backgroundColor: '#f0f0f0' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#111' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
      backgroundColor: '#d7d7d7',
    },
    '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
      backgroundColor: '#e0e0e0',
      outline: '1px solid #b0b0b0',
    },
    '.cm-nonmatchingBracket': { outline: '1px solid #999' },
  },
  { dark: false },
);

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.moduleKeyword, t.controlKeyword], color: '#7a3e9d' },
  { tag: [t.string, t.special(t.string), t.regexp], color: '#2f6f43' },
  { tag: [t.number, t.bool, t.null, t.atom], color: '#9c5700' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: '#8a8a8a', fontStyle: 'italic' },
  { tag: [t.tagName, t.heading], color: '#1c5b9c' },
  { tag: [t.attributeName, t.propertyName], color: '#7a3e9d' },
  { tag: [t.variableName, t.definition(t.variableName)], color: '#111' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#1c5b9c' },
  { tag: [t.className, t.typeName, t.namespace], color: '#9c5700' },
  { tag: [t.operator, t.punctuation, t.bracket, t.angleBracket], color: '#555' },
  { tag: [t.invalid], color: '#b00020' },
]);

export const theme: Extension = [base, syntaxHighlighting(highlight)];
