// The engine's view of this browser: boards in IndexedDB, or live in a tab when open.
import * as Y from 'yjs';
import { REMOTE_SYNC } from '$lib/model/origins';
import { boardChannelName, loadSnapshot, writeSnapshot } from '../boardDoc';
import { getDB } from '../db';
import type { SyncLocal, SyncStateStore } from './engine';
import { openDoc } from './hub';

export const idbSyncLocal: SyncLocal = {
	async boardIds() {
		return (await getDB()).getAllKeys('boards');
	},
	async read(id) {
		const doc = openDoc(id);
		return doc ? Y.encodeStateAsUpdate(doc) : loadSnapshot(id);
	},
	async apply(id, update) {
		const doc = openDoc(id);
		if (doc) {
			// The board's saver stores it; tab sync forwards it to other tabs.
			Y.applyUpdate(doc, update, REMOTE_SYNC);
			return;
		}
		await writeSnapshot(id, update, REMOTE_SYNC);
		// Tabs with the board open take it through the board's tab-sync channel.
		if (typeof BroadcastChannel === 'function') {
			const channel = new BroadcastChannel(boardChannelName(id));
			channel.postMessage({ type: 'update', update });
			channel.close();
		}
	}
};

export const idbSyncState: SyncStateStore = {
	async get(key) {
		return (await getDB()).get('sync', key);
	},
	async set(key, value) {
		await (await getDB()).put('sync', value, key);
	}
};
