/**
 * The file panel: slides in over three quarters of the screen from the right.
 *
 * It lists the files top to bottom, which is the structure view the bottom bar
 * cannot give you once there are more than a handful. With no bar along the top
 * on mobile, it is also where the theme control lives.
 *
 * A real <dialog>, so the backdrop, Escape and focus trapping come for free.
 */
import type { FileDoc, ThemeMode } from '../state';
import { closeOnBackdrop } from './dismiss';
import { applyTheme, nextTheme, themeLabel } from './theme';

export interface DrawerOptions {
  theme: ThemeMode;
  onSettings: () => void;
  onSelect: (id: string) => void;
  onRename: (id: string) => void;
  onCreate: () => void;
  onThemeChange: (mode: ThemeMode) => void;
}

export interface Drawer {
  open(files: readonly FileDoc[], activeId: string): void;
}

function button(className: string, text: string): HTMLButtonElement {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = className;
  node.textContent = text;
  return node;
}

export function createDrawer(options: DrawerOptions): Drawer {
  let theme = options.theme;

  const dialog = document.createElement('dialog');
  dialog.className = 'sl-drawer';

  const header = document.createElement('div');
  header.className = 'sl-drawer-header';

  const heading = document.createElement('h2');
  heading.textContent = 'Files';

  // The backdrop is only a quarter of the screen wide, so give the drawer a
  // control of its own rather than relying on people finding the edge.
  const close = button('sl-drawer-close', 'Close');
  close.setAttribute('aria-label', 'Close file panel');
  close.addEventListener('click', () => dialog.close());

  header.append(heading, close);

  const list = document.createElement('div');
  list.className = 'sl-drawer-list';

  const create = button('sl-drawer-action', 'New file');
  create.addEventListener('click', () => {
    dialog.close();
    options.onCreate();
  });

  const settings = button('sl-drawer-action', 'Settings');
  settings.addEventListener('click', () => {
    dialog.close();
    options.onSettings();
  });

  const themeButton = button('sl-drawer-action', themeLabel(theme));
  themeButton.addEventListener('click', () => {
    theme = nextTheme(theme);
    applyTheme(theme);
    themeButton.textContent = themeLabel(theme);
    options.onThemeChange(theme);
  });

  const footer = document.createElement('div');
  footer.className = 'sl-drawer-footer';
  footer.append(create, settings, themeButton);

  dialog.append(header, list, footer);
  closeOnBackdrop(dialog);
  document.body.append(dialog);

  return {
    open(files, activeId): void {
      list.replaceChildren();

      for (const file of files) {
        const row = document.createElement('div');
        row.className = 'sl-drawer-row' + (file.id === activeId ? ' sl-drawer-current' : '');

        const pick = button('sl-drawer-name', file.name);
        pick.addEventListener('click', () => {
          dialog.close();
          options.onSelect(file.id);
        });
        row.append(pick);

        // Offered on the file you are in, matching the bottom bar's rule that
        // tapping the current file is how you rename it.
        if (file.id === activeId) {
          const rename = button('sl-drawer-rename', 'Rename');
          rename.addEventListener('click', () => {
            dialog.close();
            options.onRename(file.id);
          });
          row.append(rename);
        }

        list.append(row);
      }

      dialog.showModal();
    },
  };
}
