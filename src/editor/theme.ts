/**
 * Editor theme.
 *
 * Every colour is a CSS custom property owned by styles.css, so light and dark
 * are one token swap on <html> - no second theme object, no Compartment, no
 * reconfiguring live editor states when the user flips the switch.
 *
 * Syntax highlighting keeps a small muted palette because token colour is
 * functional here, not decorative: a beginner needs to see that a string is a
 * string.
 */
import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import type { Extension } from '@codemirror/state';

const base = EditorView.theme({
  '&': {
    color: 'var(--fg)',
    backgroundColor: 'var(--bg)',
    fontSize: '13px',
  },
  '.cm-content': {
    fontFamily: 'var(--font-mono)',
    padding: '8px 0',
    caretColor: 'var(--fg)',
  },
  // 13px * 1.5 = 19.5px was the old leading; 4px more, set explicitly so it
  // stays exact rather than drifting with the font size.
  '.cm-scroller': { lineHeight: '23.5px', fontFamily: 'var(--font-mono)' },
  '.cm-gutters': {
    backgroundColor: 'var(--gutter)',
    color: 'var(--gutter-fg)',
    border: 'none',
    borderRight: '1px solid var(--line)',
  },
  '.cm-activeLineGutter': { backgroundColor: 'var(--surface-2)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--fg)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--selection)',
  },
  '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
    backgroundColor: 'var(--fill-strong)',
    outline: '1px solid var(--border-strong)',
  },
  '.cm-nonmatchingBracket': { outline: '1px solid var(--border-strong)' },
});

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.moduleKeyword, t.controlKeyword], color: 'var(--syn-keyword)' },
  { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--syn-string)' },
  { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--syn-number)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: [t.tagName, t.heading], color: 'var(--syn-tag)' },
  { tag: [t.attributeName, t.propertyName], color: 'var(--syn-keyword)' },
  { tag: [t.variableName, t.definition(t.variableName)], color: 'var(--syn-name)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--syn-tag)' },
  { tag: [t.className, t.typeName, t.namespace], color: 'var(--syn-type)' },
  { tag: [t.operator, t.punctuation, t.bracket, t.angleBracket], color: 'var(--syn-punct)' },
  { tag: [t.invalid], color: 'var(--syn-invalid)' },
]);

export const theme: Extension = [base, syntaxHighlighting(highlight)];
