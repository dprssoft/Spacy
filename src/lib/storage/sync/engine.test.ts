import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { getMeta } from '$lib/model/doc';
import { SCHEMA_VERSION } from '$lib/model/migrations';
import { LOCAL, REMOTE_SYNC } from '$lib/model/origins';
import { SyncEngine, type SyncLocal, type SyncStateStore } from './engine';
import { MemoryRemoteStore } from './remote';
import { SyncStatus } from './status';

/** A simulated device: boards as live docs, bookkeeping in a map. */
class Device {
	readonly docs = new Map<string, Y.Doc>();
	readonly saved = new Map<string, unknown>();
	readonly status = new SyncStatus();
	readonly engine: SyncEngine;

	constructor(
		readonly name: string,
		store: MemoryRemoteStore,
		compactAt?: number
	) {
		const local: SyncLocal = {
			boardIds: async () => [...this.docs.keys()],
			read: async (id) => Y.encodeStateAsUpdate(this.doc(id)),
			apply: async (id, update) => Y.applyUpdate(this.doc(id), update, REMOTE_SYNC)
		};
		const state: SyncStateStore = {
			get: async (k) => structuredClone(this.saved.get(k)),
			set: async (k, v) => void this.saved.set(k, structuredClone(v))
		};
		this.engine = new SyncEngine({
			store,
			local,
			state,
			device: name,
			status: this.status,
			compactAt
		});
	}

	doc(id: string): Y.Doc {
		let doc = this.docs.get(id);
		if (!doc) {
			doc = new Y.Doc();
			this.docs.set(id, doc);
		}
		return doc;
	}

	set(board: string, key: string, value: string): void {
		const doc = this.doc(board);
		doc.transact(() => doc.getMap('m').set(key, value), LOCAL);
	}

	get(board: string): Record<string, unknown> {
		return this.doc(board).getMap('m').toJSON();
	}
}

function setup(compactAt?: number) {
	const store = new MemoryRemoteStore();
	return {
		store,
		a: new Device('A', store, compactAt),
		b: new Device('B', store, compactAt),
		c: new Device('C', store, compactAt)
	};
}

describe('SyncEngine', () => {
	it('brings edits made on one device to another', async () => {
		const { a, b } = setup();
		a.set('board1', 'title', 'Plan');
		await a.engine.cycle();
		await b.engine.cycle();
		expect(b.get('board1')).toEqual({ title: 'Plan' });
		expect(b.status.overall.kind).toBe('synced');
	});

	it('merges concurrent edits', async () => {
		const { a, b } = setup();
		a.set('x', 'a', '1');
		b.set('x', 'b', '2');
		await a.engine.cycle();
		await b.engine.cycle();
		await a.engine.cycle();
		expect(a.get('x')).toEqual({ a: '1', b: '2' });
		expect(b.get('x')).toEqual({ a: '1', b: '2' });
	});

	it('syncs deletions, which do not change the state vector', async () => {
		const { a, b } = setup();
		a.set('x', 'k', 'v');
		await a.engine.cycle();
		await b.engine.cycle();
		a.doc('x').transact(() => a.doc('x').getMap('m').delete('k'), LOCAL);
		await a.engine.cycle();
		await b.engine.cycle();
		expect(b.get('x')).toEqual({});
	});

	it('uploads only what changed, and nothing when nothing did', async () => {
		const { store, a, b } = setup();
		a.set('x', 'k', 'v');
		await a.engine.cycle();
		await a.engine.cycle();
		expect(store.calls.create).toBe(1);
		// B downloads and has nothing of its own: no echo upload.
		await b.engine.cycle();
		expect(store.calls.create).toBe(1);
		// Own files are never downloaded again.
		await a.engine.cycle();
		expect(store.calls.read).toBe(1);
	});

	it('uploads edits made while offline once back online', async () => {
		const { store, a, b } = setup();
		store.failWhen = () => true;
		a.set('x', 'offline', 'yes');
		await expect(a.engine.cycle()).rejects.toThrow();
		expect(a.status.overall.kind).toBe('error');
		store.failWhen = null;
		await a.engine.cycle();
		await b.engine.cycle();
		expect(b.get('x')).toEqual({ offline: 'yes' });
	});

	it('retries a failed upload without losing anything', async () => {
		const { store, a, b } = setup();
		a.set('x', 'one', '1');
		await a.engine.cycle();
		store.failWhen = (op) => op === 'create';
		a.set('x', 'two', '2');
		await expect(a.engine.cycle()).rejects.toThrow();
		a.set('x', 'three', '3');
		store.failWhen = null;
		await a.engine.cycle();
		await b.engine.cycle();
		expect(b.get('x')).toEqual({ one: '1', two: '2', three: '3' });
	});

	it('retries a failed download', async () => {
		const { store, a, b } = setup();
		a.set('x', 'k', 'v');
		await a.engine.cycle();
		store.failWhen = (op) => op === 'read';
		await expect(b.engine.cycle()).rejects.toThrow();
		store.failWhen = null;
		await b.engine.cycle();
		expect(b.get('x')).toEqual({ k: 'v' });
	});

	it('compacts many files into one snapshot', async () => {
		const { store, a, b } = setup(5);
		for (let i = 0; i < 6; i++) {
			a.set('x', `k${i}`, String(i));
			await a.engine.cycle();
		}
		expect(store.list().filter((f) => f.props.board === 'x').length).toBeLessThan(5);
		expect(store.list().some((f) => f.props.kind === 'snapshot')).toBe(true);
		await b.engine.cycle();
		expect(Object.keys(b.get('x'))).toHaveLength(6);
	});

	it('keeps files another device uploaded during compaction', async () => {
		const { store, a, b, c } = setup(4);
		for (let i = 0; i < 3; i++) {
			a.set('x', `a${i}`, 'a');
			await a.engine.cycle();
		}
		// B uploads after A last looked; A then compacts without having seen B's file.
		b.set('x', 'b', 'b');
		await b.engine.cycle(); // B also downloads A's three files
		const changes = store.changes.bind(store);
		let hide = true;
		store.changes = async (cursor) => {
			const r = await changes(cursor);
			if (!hide) return r;
			// A's view of the remote is a moment old: B's upload isn't in it yet.
			hide = false;
			return { ...r, files: r.files.filter((f) => f.props.device !== 'B'), cursor: cursor ?? '0' };
		};
		a.set('x', 'a3', 'a');
		await a.engine.cycle(); // 4 files known to A → compacts, B's file stays
		expect(store.list().some((f) => f.props.device === 'B')).toBe(true);
		await c.engine.cycle();
		expect(Object.keys(c.get('x')).sort()).toEqual(['a0', 'a1', 'a2', 'a3', 'b']);
	});

	it('survives two devices compacting at once', async () => {
		const { a, b, c } = setup(3);
		for (let i = 0; i < 3; i++) {
			a.set('x', `a${i}`, '1');
			b.set('x', `b${i}`, '1');
			await Promise.all([a.engine.cycle(), b.engine.cycle()]);
		}
		await Promise.all([a.engine.cycle(), b.engine.cycle()]);
		await c.engine.cycle();
		expect(Object.keys(c.get('x'))).toHaveLength(6);
	});

	it('pauses a board whose remote changes need a newer app', async () => {
		const { a, b } = setup();
		a.set('x', 'k', 'v');
		a.doc('x').transact(() => getMeta(a.doc('x')).set('schemaVersion', SCHEMA_VERSION + 1));
		a.set('y', 'k', 'v');
		await a.engine.cycle();
		b.set('x', 'local', 'kept');
		await b.engine.cycle();
		expect(b.get('x')).toEqual({ local: 'kept' });
		expect(b.status.board('x')).toEqual({ kind: 'newer-schema', version: SCHEMA_VERSION + 1 });
		// Other boards still sync.
		expect(b.get('y')).toEqual({ k: 'v' });
	});

	it('keeps remote changes out of the undo stack', async () => {
		const { a, b } = setup();
		const undo = new Y.UndoManager(b.doc('x').getMap('m'), { trackedOrigins: new Set([LOCAL]) });
		a.set('x', 'remote', '1');
		await a.engine.cycle();
		await b.engine.cycle();
		expect(b.get('x')).toEqual({ remote: '1' });
		expect(undo.undoStack).toHaveLength(0);
	});

	it('runs one cycle at a time', async () => {
		const { store, a } = setup();
		store.latencyMs = 5;
		a.set('x', 'k', 'v');
		await Promise.all([a.engine.cycle(), a.engine.cycle()]);
		expect(store.calls.create).toBe(1);
	});
});
