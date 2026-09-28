import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AssetRecord, BoardMeta } from './types';

export const DB_NAME = 'smthng';

export interface SmthngDB extends DBSchema {
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

let dbPromise: Promise<IDBPDatabase<SmthngDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<SmthngDB>> {
	dbPromise ??= openDB<SmthngDB>(DB_NAME, 1, {
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
	});
	return dbPromise;
}

/** Closes the connection and forgets it, so tests can delete the database between runs. */
export async function resetDBForTests(): Promise<void> {
	const pending = dbPromise;
	dbPromise = null;
	(await pending)?.close();
}
