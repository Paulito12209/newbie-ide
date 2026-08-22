/**
 * The concept-teaching layer. Loaded lazily by main.ts after the editor is up,
 * so it stays off the cold-load path.
 */
export { installSlashMenu as installConcepts } from './slash-menu';
export type { Workspace } from './workspace';
