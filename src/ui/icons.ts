/** Inline SVG, so the icons cost no request and inherit the text colour. */
const svg = (body: string, size = 18): string =>
  `<svg viewBox="0 0 20 20" width="${size}" height="${size}" fill="none" stroke="currentColor" ` +
  `stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

/** Steppers for the clone count. */
export const ICON_CHEVRON_DOWN = svg('<polyline points="5,8 10,13 15,8"/>', 16);
export const ICON_CHEVRON_UP = svg('<polyline points="5,12 10,7 15,12"/>', 16);

/** Three dots: opens the actions for one line. */
export const ICON_DOTS =
  '<svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true" focusable="false">' +
  '<circle cx="4" cy="10" r="1.6"/><circle cx="10" cy="10" r="1.6"/><circle cx="16" cy="10" r="1.6"/></svg>';

/** Split panel: opens the file drawer. */
export const ICON_PANEL = svg('<rect x="2.5" y="3.5" width="15" height="13" rx="2"/><line x1="8" y1="3.5" x2="8" y2="16.5"/>');

/** Monitor: go to the rendered page. */
export const ICON_DISPLAY = svg('<rect x="2" y="3.5" width="16" height="11" rx="1.5"/><line x1="7" y1="17.5" x2="13" y2="17.5"/><line x1="10" y1="14.5" x2="10" y2="17.5"/>');

/** Angle brackets: go back to the code. */
export const ICON_CODE = svg('<polyline points="7,5.5 2.5,10 7,14.5"/><polyline points="13,5.5 17.5,10 13,14.5"/>');
