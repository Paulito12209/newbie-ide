/**
 * The concept-teaching layer. Loaded lazily by main.ts after the editor is up,
 * so it stays off the cold-load path and out of the entry chunk.
 */
export { installSlashMenu as installConcepts } from './slash-menu';
