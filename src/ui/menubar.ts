/**
 * The menu bar: one narrow row above the panes.
 *
 * Holds the app name on the left and an actions group on the right. The theme
 * control is the only action today; the group is where later ones go.
 */
import type { ThemeMode } from '../state';
import { applyTheme, nextTheme, themeLabel } from './theme';

export interface MenuBarOptions {
  theme: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
}

export function createMenuBar(host: HTMLElement, options: MenuBarOptions): void {
  let theme = options.theme;

  const name = document.createElement('span');
  name.className = 'mb-name';
  name.textContent = 'Slashlearn';

  const actions = document.createElement('div');
  actions.className = 'mb-actions';

  const themeButton = document.createElement('button');
  themeButton.type = 'button';
  themeButton.className = 'mb-button';

  function paint(): void {
    themeButton.textContent = themeLabel(theme);
    themeButton.setAttribute(
      'aria-label',
      `${themeLabel(theme)}. Switch to ${themeLabel(nextTheme(theme)).replace('Theme: ', '')}`,
    );
  }

  themeButton.addEventListener('click', () => {
    theme = nextTheme(theme);
    applyTheme(theme);
    paint();
    options.onThemeChange(theme);
  });

  paint();
  actions.append(themeButton);
  host.append(name, actions);
}
