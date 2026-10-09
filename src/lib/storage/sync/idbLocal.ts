// The engine's view of this browser: boards in IndexedDB, or live in a tab when open, plus the
// library doc (the synced board list).
import * as Y from 'yjs';
import { REMOTE_SYNC } from '$lib/model/origins';
import { loadSnapshot, postToTabs, readTitle, writeSnapshot } from '../boardDoc';
import { destroyBoard } from '../boardLifecycle';
import * as assetsRepo from '../assetsRepo';
import * as boardsRepo from '../boardsRepo';
import { getDB } from '../db';
import type { SyncLocal, SyncStateStore } from './engine';
import { openDoc } from './hub';
import { LIBRARY_ID, purgedIds, reconcile, type LocalList } from './library';

export const idbSyncState: SyncStateStore = {
	async get(key) {
		return (await getDB()).get('sync', key);
	},
	async set(key, value) {
		await (await getDB()).put('sync', value, key);
	}
};

export const idbLocalList: LocalList = {
	all: async () => (await getDB()).getAll('boards'),
	create: (id, fields, title) => boardsRepo.insert(id, { ...fields, title }),
	update: (id, fields) => boardsRepo.setSynced(id, fields),
	destroy: destroyBoard,
	title: readTitle
};

/** `library`: the board list doc; without it only board contents sync. */
export function createIdbSyncLocal(library?: Y.Doc): SyncLocal {
	return {
		async boardIds() {
			const ids = await (await getDB()).getAllKeys('boards');
			return library ? [LIBRARY_ID, ...ids] : ids;
		},
		async read(id) {
			if (library && id === LIBRARY_ID) return Y.encodeStateAsUpdate(library);
			const doc = openDoc(id);
			return doc ? Y.encodeStateAsUpdate(doc) : loadSnapshot(id);
		},
		async apply(id, update) {
			if (library && id === LIBRARY_ID) return Y.applyUpdate(library, update, REMOTE_SYNC);
			const doc = openDoc(id);
			if (doc) {
				// The board's saver stores it, tab sync forwards it, and the board page updates the
				// list's title from it.
				Y.applyUpdate(doc, update, REMOTE_SYNC);
				return;
			}
			await writeSnapshot(id, update, REMOTE_SYNC);
			postToTabs(id, update);
			const meta = await boardsRepo.get(id);
			const title = meta && (await readTitle(id));
			if (meta && title && title !== meta.title) await boardsRepo.rename(id, title);
		},
		purgedBoards: async () => (library ? purgedIds(library) : new Set()),
		assets: {
			ids: async () => (await getDB()).getAllKeys('assets'),
			read: async (id) => (await assetsRepo.get(id)) ?? null,
			write: (asset) => assetsRepo.putSynced(asset)
		},
		async afterDownload() {
			if (!library) return [];
			return (await reconcile(library, idbLocalList, idbSyncState)) ? [LIBRARY_ID] : [];
		}
	};
}
