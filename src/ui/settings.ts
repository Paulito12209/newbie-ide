/**
 * Rules: what the editor is allowed to reach for.
 *
 * Everything starts locked on purpose. This is meant to be a place you grow
 * into, so the language you work in widens when you decide it should - not on
 * day one. Every rule here changes what the tool actually writes; none of them
 * is decoration.
 */
import { closeOnBackdrop } from './dismiss';
import type { Rules } from '../state';

interface RuleInfo {
  key: keyof Rules;
  label: string;
  /** What is true while the rule is off. */
  locked: string;
  /** What changes when it is on. */
  unlocked: string;
}

const RULES: readonly RuleInfo[] = [
  {
    key: 'grid',
    label: 'CSS Grid',
    locked: 'Column and card templates write flexbox.',
    unlocked: 'Templates write CSS grid instead, with a rule per column count.',
  },
  {
    key: 'addEventListener',
    label: 'addEventListener',
    locked: 'Examples use button.onclick = function () { ... }.',
    unlocked: 'Examples use button.addEventListener("click", ...).',
  },
];

export interface SettingsOptions {
  rules: Rules;
  onChange: (key: keyof Rules, value: boolean) => void;
}

export function openSettings(options: SettingsOptions): void {
  const dialog = document.createElement('dialog');
  dialog.className = 'sl-settings';

  const heading = document.createElement('h2');
  heading.textContent = 'Rules';

  const intro = document.createElement('p');
  intro.className = 'sl-settings-intro';
  intro.textContent = 'Unlock what you want to work with. Everything starts off.';

  dialog.append(heading, intro);

  for (const rule of RULES) {
    const row = document.createElement('label');
    row.className = 'sl-settings-row';

    const box = document.createElement('input');
    box.type = 'checkbox';
    box.className = 'sl-settings-check';
    box.checked = options.rules[rule.key];

    const text = document.createElement('span');
    const name = document.createElement('span');
    name.className = 'sl-settings-name';
    name.textContent = rule.label;
    const note = document.createElement('span');
    note.className = 'sl-settings-note';
    note.textContent = box.checked ? rule.unlocked : rule.locked;
    text.append(name, note);

    box.addEventListener('change', () => {
      note.textContent = box.checked ? rule.unlocked : rule.locked;
      options.onChange(rule.key, box.checked);
    });

    row.append(box, text);
    dialog.append(row);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'sl-settings-close';
  close.textContent = 'Done';
  close.addEventListener('click', () => dialog.close());
  dialog.append(close);

  closeOnBackdrop(dialog);
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}
