// Transaction origins, compared by identity. Only LOCAL is tracked by the undo manager.

export interface Origin {
	readonly name: string;
}

export const LOCAL: Origin = Object.freeze({ name: 'local' });
export const REMOTE_TAB: Origin = Object.freeze({ name: 'remote-tab' });
/** Changes from the user's other devices, downloaded by the sync engine. */
export const REMOTE_SYNC: Origin = Object.freeze({ name: 'remote-sync' });
export const IMPORT: Origin = Object.freeze({ name: 'import' });
export const MIGRATION: Origin = Object.freeze({ name: 'migration' });
export const TEMPLATE: Origin = Object.freeze({ name: 'template' });
/** Page management (deleting a page's content): local, but deliberately not undoable. */
export const PAGES: Origin = Object.freeze({ name: 'pages' });
