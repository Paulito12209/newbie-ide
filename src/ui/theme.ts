/**
 * Theme mode.
 *
 * Only the shell knows about this: the editor and the concept layer read CSS
 * custom properties, so flipping the attribute on <html> is the whole switch.
 * 'system' deliberately stamps nothing, leaving prefers-color-scheme in charge.
 */
import type { ThemeMode } from '../state';

const ORDER: readonly ThemeMode[] = ['system', 'light', 'dark'];

const LABELS: Record<ThemeMode, string> = {
  system: 'Theme: Auto',
  light: 'Theme: Light',
  dark: 'Theme: Dark',
};

export function applyTheme(mode: ThemeMode): void {
  if (mode === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = mode;
}

export function nextTheme(mode: ThemeMode): ThemeMode {
  return ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length]!;
}

export function themeLabel(mode: ThemeMode): string {
  return LABELS[mode];
}
