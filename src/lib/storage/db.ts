import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { migrateLegacyDatabases } from './legacyMigration';
import type { AssetRecord, BoardMeta } from './types';

export const DB_NAME = 'spacy';
/** Each board's content lives in its own database (y-indexeddb's layout, see `boardSaver.ts`). */
export const boardDbName = (id: string): string => `spacy-board-${id}`;

export interface SpacyDB extends DBSchema {
	boards: {
		key: string;
		value: BoardMeta;
		indexes: { openedAt: number; updatedAt: number; deletedAt: number };
	};
	assets: {
		key: string;
		value: AssetRecord;
		indexes: { boardId: string };
	};
}

let dbPromise: Promise<IDBPDatabase<SpacyDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<SpacyDB>> {
	dbPromise ??= migrateLegacy().then(() =>
		openDB<SpacyDB>(DB_NAME, 1, {
			upgrade(db) {
				const boards = db.createObjectStore('boards', { keyPath: 'id' });
				boards.createIndex('openedAt', 'openedAt');
				boards.createIndex('updatedAt', 'updatedAt');
				boards.createIndex('deletedAt', 'deletedAt');
				const assets = db.createObjectStore('assets', { keyPath: 'id' });
				assets.createIndex('boardId', 'boardId');
			},
			blocking() {
				// Another tab needs a newer version: let it upgrade, reconnect on next use.
				void dbPromise?.then((db) => db.close());
				dbPromise = null;
			}
		})
	);
	return dbPromise;
}

// Boards made while the app was called SMTHNG are copied over before the database first opens. If
// that fails the app still starts (empty); the old databases are never deleted, so nothing is lost.
const migrateLegacy = () =>
	migrateLegacyDatabases(DB_NAME, boardDbName).catch((err: unknown) =>
		console.error('Copying boards from SMTHNG failed', err)
	);

/** Closes the connection and forgets it, so tests can delete the database between runs. */
export async function resetDBForTests(): Promise<void> {
	const pending = dbPromise;
	dbPromise = null;
	(await pending)?.close();
}
