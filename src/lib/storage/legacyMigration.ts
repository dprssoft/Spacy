import { deleteDB, openDB, wrap, type IDBPDatabase } from 'idb';

// Spacy used to be called SMTHNG, and its databases had that name. They're copied, not moved: the
// old ones stay, because another app (an older SMTHNG on the same origin, e.g. a dev server) may
// still use them.

export const LEGACY_DB_NAME = 'smthng';
export const legacyBoardDbName = (id: string): string => `smthng-board-${id}`;

type AnyDB = IDBPDatabase<unknown>;

/**
 * Copies the SMTHNG databases (board list, images and every board's content) to the new names,
 * once: nothing happens when the new board list exists or there's nothing to copy. The board list
 * is copied last, so a copy interrupted part-way (tab closed) starts over next time.
 */
export async function migrateLegacyDatabases(
	dbName: string,
	boardDbName: (id: string) => string
): Promise<void> {
	if (typeof indexedDB === 'undefined') return;
	const run = async () => {
		const current = await openIfExists(dbName);
		if (current) return current.close();
		const legacy = await openIfExists(LEGACY_DB_NAME);
		if (!legacy) return;
		try {
			for (const key of await legacy.getAllKeys('boards')) {
				const id = String(key);
				const board = await openIfExists(legacyBoardDbName(id));
				if (!board) continue;
				try {
					await copyDatabase(board, boardDbName(id));
				} finally {
					board.close();
				}
			}
			await copyDatabase(legacy, dbName);
		} finally {
			legacy.close();
		}
	};
	// Two tabs opened at once would copy twice; the lock makes the second one find the copy done.
	const locks = globalThis.navigator?.locks;
	if (locks) await locks.request('spacy:legacy-migration', run);
	else await run();
}

/** Opens a database only if it exists: opening a missing one would create it. */
function openIfExists(name: string): Promise<AnyDB | null> {
	return new Promise((resolve, reject) => {
		let missing = false;
		const request = indexedDB.open(name);
		request.onupgradeneeded = () => {
			// Aborting the creation leaves no database behind.
			missing = true;
			request.transaction?.abort();
		};
		request.onsuccess = () => resolve(wrap(request.result));
		request.onerror = (event) => {
			event.preventDefault();
			if (missing) resolve(null);
			else reject(request.error ?? new Error(`Couldn't open ${name}`));
		};
	});
}

/** Writes an exact copy of `src` (stores, indexes, keys and values) as `name`, replacing it. */
async function copyDatabase(src: AnyDB, name: string): Promise<void> {
	const storeNames = [...src.objectStoreNames];
	const read = src.transaction(storeNames, 'readonly');
	const stores = await Promise.all(
		storeNames.map(async (storeName) => {
			const store = read.objectStore(storeName);
			return {
				name: storeName,
				keyPath: store.keyPath,
				autoIncrement: store.autoIncrement,
				indexes: [...store.indexNames].map((indexName) => {
					const index = store.index(indexName);
					return {
						name: indexName,
						keyPath: index.keyPath,
						unique: index.unique,
						multiEntry: index.multiEntry
					};
				}),
				keys: await store.getAllKeys(),
				values: await store.getAll()
			};
		})
	);
	await read.done;

	// A copy left by an interrupted run is replaced.
	await deleteDB(name);
	const dst = await openDB(name, src.version, {
		upgrade(db) {
			for (const s of stores) {
				const store = db.createObjectStore(s.name, {
					keyPath: s.keyPath,
					autoIncrement: s.autoIncrement
				});
				for (const i of s.indexes)
					store.createIndex(i.name, i.keyPath, { unique: i.unique, multiEntry: i.multiEntry });
			}
		}
	});
	try {
		if (storeNames.length === 0) return;
		const write = dst.transaction(storeNames, 'readwrite');
		for (const s of stores) {
			const store = write.objectStore(s.name);
			s.values.forEach((value, i) => {
				// Stores without a key path (y-indexeddb's) take the key explicitly.
				void (s.keyPath === null ? store.put(value, s.keys[i]) : store.put(value));
			});
		}
		await write.done;
	} finally {
		dst.close();
	}
}
