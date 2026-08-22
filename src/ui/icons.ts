/** Inline SVG, so the icons cost no request and inherit the text colour. */
const svg = (body: string, size = 18): string =>
  `<svg viewBox="0 0 20 20" width="${size}" height="${size}" fill="none" stroke="currentColor" ` +
  `stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

/** Split panel: opens the file drawer. */
export const ICON_PANEL = svg('<rect x="2.5" y="3.5" width="15" height="13" rx="2"/><line x1="8" y1="3.5" x2="8" y2="16.5"/>');

/** Monitor: go to the rendered page. */
export const ICON_DISPLAY = svg('<rect x="2" y="3.5" width="16" height="11" rx="1.5"/><line x1="7" y1="17.5" x2="13" y2="17.5"/><line x1="10" y1="14.5" x2="10" y2="17.5"/>');

/** Angle brackets: go back to the code. */
export const ICON_CODE = svg('<polyline points="7,5.5 2.5,10 7,14.5"/><polyline points="13,5.5 17.5,10 13,14.5"/>');
