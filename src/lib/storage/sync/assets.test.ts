import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { createElements, deleteElements } from '$lib/model/ops';
import { REMOTE_SYNC } from '$lib/model/origins';
import { samples } from '$lib/model/testFixtures';
import { keyTooLarge } from './assetFlags';
import {
	MAX_ASSET_BYTES,
	SyncEngine,
	type LocalAsset,
	type SyncLocal,
	type SyncStateStore
} from './engine';
import { requestAsset, serveAssetRequests } from './hub';
import { MemoryRemoteStore } from './remote';

class Device {
	readonly docs = new Map<string, Y.Doc>();
	readonly assets = new Map<string, LocalAsset>();
	readonly saved = new Map<string, unknown>();
	readonly purged = new Set<string>();
	readonly engine: SyncEngine;

	constructor(store: MemoryRemoteStore, name: string, compactAt?: number) {
		const local: SyncLocal = {
			boardIds: async () => [...this.docs.keys()],
			read: async (id) => Y.encodeStateAsUpdate(this.doc(id)),
			apply: async (id, u) => Y.applyUpdate(this.doc(id), u, REMOTE_SYNC),
			purgedBoards: async () => new Set(this.purged),
			assets: {
				ids: async () => [...this.assets.keys()],
				read: async (id) => this.assets.get(id) ?? null,
				write: async (a) => void this.assets.set(a.id, a)
			}
		};
		const state: SyncStateStore = {
			get: async (k) => this.saved.get(k),
			set: async (k, v) => void this.saved.set(k, v)
		};
		this.engine = new SyncEngine({ store, local, state, device: name, compactAt });
	}

	doc(id: string): Y.Doc {
		let doc = this.docs.get(id);
		if (!doc) this.docs.set(id, (doc = new Y.Doc()));
		return doc;
	}

	addImage(board: string, elementId: string, assetId: string, bytes = 10): void {
		this.assets.set(assetId, {
			id: assetId,
			boardId: board,
			blob: new Blob([new Uint8Array(bytes)], { type: 'image/png' }),
			mime: 'image/png',
			width: 40,
			height: 30
		});
		createElements(this.doc(board), [{ ...samples.image(elementId), assetId }]);
	}
}

function setup(compactAt?: number) {
	const store = new MemoryRemoteStore();
	return { store, a: new Device(store, 'A', compactAt), b: new Device(store, 'B', compactAt) };
}

const assetFiles = (store: MemoryRemoteStore) =>
	store.list().filter((f) => f.props.kind === 'asset');

describe('image sync', () => {
	it('uploads an image once and downloads it on demand', async () => {
		const { store, a, b } = setup();
		a.addImage('x', 'img1', 'asset1');
		await a.engine.cycle();
		await a.engine.cycle();
		expect(assetFiles(store)).toHaveLength(1);

		await b.engine.cycle();
		expect(b.assets.has('asset1')).toBe(false);
		expect(await b.engine.fetchAsset('asset1')).toBe(true);
		const got = b.assets.get('asset1');
		expect(got).toMatchObject({ boardId: 'x', mime: 'image/png', width: 40, height: 30 });
		expect(got?.blob.size).toBe(10);
		// Already known remotely: not uploaded back.
		await b.engine.cycle();
		expect(assetFiles(store)).toHaveLength(1);
	});

	it('answers false for an image no device has uploaded', async () => {
		const { b } = setup();
		await b.engine.cycle();
		expect(await b.engine.fetchAsset('nope')).toBe(false);
	});

	it('resumes an interrupted upload on the next cycle', async () => {
		const { store, a, b } = setup();
		a.addImage('x', 'img1', 'asset1');
		store.failWhen = (op, name) => op === 'create' && name.startsWith('asset.');
		await expect(a.engine.cycle()).rejects.toThrow();
		store.failWhen = null;
		await a.engine.cycle();
		await b.engine.cycle();
		expect(await b.engine.fetchAsset('asset1')).toBe(true);
	});

	it('deletes the images of a board deleted forever', async () => {
		const { store, a } = setup();
		a.addImage('x', 'img1', 'asset1');
		a.addImage('y', 'img2', 'asset2');
		await a.engine.cycle();
		a.purged.add('x');
		await a.engine.cycle();
		expect(assetFiles(store).map((f) => f.props.asset)).toEqual(['asset2']);
	});

	it('skips and flags an image that is too large', async () => {
		const { store, a } = setup();
		a.addImage('x', 'img1', 'big', MAX_ASSET_BYTES + 1);
		await a.engine.cycle();
		expect(assetFiles(store)).toEqual([]);
		expect(a.saved.get(keyTooLarge('big'))).toBe(true);
	});

	it('compaction removes images no longer on the board', async () => {
		const { store, a } = setup(3);
		a.addImage('x', 'img1', 'keep');
		a.addImage('x', 'img2', 'drop');
		await a.engine.cycle();
		deleteElements(a.doc('x'), ['img2']);
		await a.engine.cycle();
		a.addImage('x', 'img3', 'later');
		await a.engine.cycle();
		expect(store.list().some((f) => f.props.kind === 'snapshot')).toBe(true);
		expect(
			assetFiles(store)
				.map((f) => f.props.asset)
				.sort()
		).toEqual(['keep', 'later']);
	});

	it('another tab asks the syncing tab for an image', async () => {
		const { a, b } = setup();
		a.addImage('x', 'img1', 'asset1');
		await a.engine.cycle();
		await b.engine.cycle();
		const stop = serveAssetRequests((id) => b.engine.fetchAsset(id));
		let acked = false;
		expect(await requestAsset('asset1', { onAck: () => (acked = true) })).toBe(true);
		expect(acked).toBe(true);
		expect(b.assets.has('asset1')).toBe(true);
		stop();
	});

	it('an image request without sync gives up quickly', async () => {
		expect(await requestAsset('asset1', { ackMs: 10 })).toBe(false);
	});
});
