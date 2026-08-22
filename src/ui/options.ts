/**
 * The options menu behind the button at the end of the file bar.
 *
 * A native popover: the top layer, light dismiss and Escape come for free. On
 * mobile there is no bar along the top any more, so this is where the theme
 * control lives.
 */
import type { ThemeMode } from '../state';
import { applyTheme, nextTheme, themeLabel } from './theme';

export interface OptionsMenuOptions {
  theme: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
}

export interface OptionsMenu {
  toggle(): void;
}

export function createOptionsMenu(options: OptionsMenuOptions): OptionsMenu {
  let theme = options.theme;

  const menu = document.createElement('div');
  menu.className = 'sl-options';
  menu.popover = 'auto';

  const themeButton = document.createElement('button');
  themeButton.type = 'button';
  themeButton.className = 'sl-options-item';

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
  menu.append(themeButton);
  document.body.append(menu);

  return {
    toggle(): void {
      menu.togglePopover();
    },
  };
}
