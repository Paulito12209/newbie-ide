/**
 * The narrow slice of the project the teaching layer is allowed to touch.
 *
 * Layout templates need to add rules to the stylesheet, and those rules have to
 * end up in the file the user can see and edit - not in some hidden sheet. This
 * is the only door for that, and it opens one way.
 */
import type { CssBlock } from './layouts';

export interface Workspace {
  /** Adds each block to the project stylesheet unless it is already there. */
  ensureCss(blocks: readonly CssBlock[]): void;
}
