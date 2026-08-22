/**
 * The file bar.
 *
 * Desktop keeps it as a strip at the top of the editor pane. On mobile it
 * becomes a dark bar floating over the code at the bottom of the screen - see
 * the mobile block in styles.css; the markup is the same either way.
 *
 * Tapping another file switches to it. Tapping the file you are already in
 * opens the rename dialog, which is how a name gets changed without a second
 * control competing for the same 60 pixels.
 */
import type { FileDoc } from '../state';

export interface TabsOptions {
  onSelect: (id: string) => void;
  onRename: (id: string) => void;
  onCreate: () => void;
  onOptions: () => void;
}

export interface Tabs {
  render(files: readonly FileDoc[], activeId: string): void;
}

const DOTS =
  '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">' +
  '<circle cx="3" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="13" cy="8" r="1.5"/></svg>';

export function createTabs(host: HTMLElement, options: TabsOptions): Tabs {
  const scroller = document.createElement('div');
  scroller.className = 'tabs-scroll';
  scroller.role = 'tablist';
  scroller.ariaLabel = 'Files';

  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'tab-add';
  add.textContent = '+';
  add.title = 'New file';
  add.setAttribute('aria-label', 'New file');
  add.addEventListener('click', () => options.onCreate());

  const menu = document.createElement('button');
  menu.type = 'button';
  menu.className = 'tab-options';
  menu.innerHTML = DOTS;
  menu.title = 'Options';
  menu.setAttribute('aria-label', 'Options');
  menu.addEventListener('click', () => options.onOptions());

  host.append(scroller, menu);

  return {
    render(files, activeId): void {
      scroller.replaceChildren();

      for (const file of files) {
        const selected = file.id === activeId;
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.role = 'tab';
        tab.textContent = file.name;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
        tab.addEventListener('click', () => {
          if (file.id === activeId) options.onRename(file.id);
          else options.onSelect(file.id);
        });
        tab.addEventListener('keydown', (event) => {
          const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
          if (!delta) return;
          event.preventDefault();
          const index = files.findIndex((entry) => entry.id === file.id);
          const next = files[(index + delta + files.length) % files.length]!;
          options.onSelect(next.id);
        });
        scroller.append(tab);
      }

      scroller.append(add);
      scroller.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
      });
    },
  };
}
