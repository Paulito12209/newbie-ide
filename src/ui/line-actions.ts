/**
 * The menu behind the dots at the end of a line.
 *
 * Copy the line, or clone it a given number of times - the traffic-light case,
 * where you want the same element three times over and typing it out on a phone
 * is the whole problem.
 *
 * A popover rather than a dialog: it belongs to the line it came from, and
 * light dismiss comes for free.
 */
export interface LineActionsOptions {
  /** Where the dots are, so the menu can sit next to them. */
  anchor: DOMRect;
  onCopy: () => void;
  onSelect: () => void;
  onDelete: () => void;
  onClone: (times: number) => void;
}

import { ICON_CHEVRON_DOWN, ICON_CHEVRON_UP } from './icons';

const MAX_CLONES = 50;

export function openLineActions(options: LineActionsOptions): void {
  document.querySelector('.sl-line-menu')?.remove();

  const menu = document.createElement('div');
  menu.className = 'sl-line-menu';
  menu.popover = 'auto';

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'sl-line-item';
  copy.textContent = 'Copy line';
  copy.addEventListener('click', () => {
    options.onCopy();
    menu.hidePopover();
  });

  const select = document.createElement('button');
  select.type = 'button';
  select.className = 'sl-line-item';
  select.textContent = 'Select lines';
  select.addEventListener('click', () => {
    options.onSelect();
    menu.hidePopover();
  });

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'sl-line-item sl-line-danger';
  remove.textContent = 'Delete line';
  remove.addEventListener('click', () => {
    options.onDelete();
    menu.hidePopover();
  });

  const cloneRow = document.createElement('div');
  cloneRow.className = 'sl-line-clone';

  const label = document.createElement('span');
  label.className = 'sl-line-label';
  label.textContent = 'Clone line';

  const count = document.createElement('input');
  count.type = 'number';
  count.min = '1';
  count.max = String(MAX_CLONES);
  count.value = '1';
  count.className = 'sl-line-count';
  count.setAttribute('aria-label', 'How many copies');

  const clamp = (n: number): number => Math.min(MAX_CLONES, Math.max(1, Math.round(n) || 1));
  const step = (by: number): void => {
    count.value = String(clamp(Number(count.value) + by));
  };

  // Side by side rather than a stacked spinner: stacked, each arrow would be
  // about 17px tall, which is not a touch target.
  const stepper = (delta: number, icon: string, label: string): HTMLButtonElement => {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'sl-line-step';
    node.innerHTML = icon;
    node.setAttribute('aria-label', label);
    node.addEventListener('click', () => step(delta));
    return node;
  };

  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'sl-line-add';
  add.textContent = '+ Add';
  add.addEventListener('click', () => {
    options.onClone(clamp(Number(count.value)));
    menu.hidePopover();
  });

  count.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') add.click();
  });

  const controls = document.createElement('div');
  controls.className = 'sl-line-controls';
  controls.append(count, stepper(-1, ICON_CHEVRON_DOWN, 'Fewer'), stepper(1, ICON_CHEVRON_UP, 'More'), add);
  cloneRow.append(label, controls);

  menu.append(copy, select, remove, cloneRow);
  menu.addEventListener('toggle', (event) => {
    if ((event as ToggleEvent).newState === 'closed') menu.remove();
  });

  document.body.append(menu);
  menu.showPopover();

  // Placed after showing, so the menu has been measured.
  const box = menu.getBoundingClientRect();
  const gap = 6;
  const left = Math.min(Math.max(8, options.anchor.left), window.innerWidth - box.width - 8);
  const below = options.anchor.bottom + gap;
  const top = below + box.height > window.innerHeight - 8 ? options.anchor.top - box.height - gap : below;
  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(Math.max(8, top))}px`;
}
