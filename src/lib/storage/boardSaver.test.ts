import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { BoardSaver, COMPACT_AT, type SaveState } from './boardSaver';

let n = 0;
const fresh = () => `saver-test-${++n}`;

/** Reopens the stored board in a new doc and returns its text. */
async function stored(name: string): Promise<string> {
	const doc = new Y.Doc();
	const saver = await BoardSaver.open(name, doc);
	const text = doc.getText('t').toString();
	await saver.destroy();
	doc.destroy();
	return text;
}

/** Lets pending IndexedDB transactions finish. */
const settle = () => new Promise((r) => setTimeout(r, 20));

afterEach(() => {
	vi.restoreAllMocks();
	vi.spyOn(console, 'error').mockRestore();
});

function quiet() {
	vi.spyOn(console, 'error').mockImplementation(() => {});
}

describe('BoardSaver', () => {
	it('saves updates and loads them back', async () => {
		const name = fresh();
		const doc = new Y.Doc();
		const saver = await BoardSaver.open(name, doc);
		doc.getText('t').insert(0, 'hello');
		await settle();
		expect(saver.state.kind).toBe('saved');
		await saver.destroy();
		expect(await stored(name)).toBe('hello');
	});

	it('reports a write that throws, and retry saves the whole board', async () => {
		quiet();
		const name = fresh();
		const doc = new Y.Doc();
		const saver = await BoardSaver.open(name, doc);
		const states: SaveState['kind'][] = [];
		saver.subscribe((s) => states.push(s.kind));

		const add = vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementationOnce(() => {
			throw new DOMException('Full', 'QuotaExceededError');
		});
		doc.getText('t').insert(0, 'lost?');
		await settle();
		expect(saver.state.kind).toBe('failed');
		add.mockRestore();
		doc.getText('t').insert(5, '!');
		await settle();
		expect(saver.state.kind).toBe('failed'); // a later write alone doesn't fix the gap

		expect(await saver.retry()).toBe(true);
		expect(states).toEqual(['failed', 'saved']);
		await saver.destroy();
		expect(await stored(name)).toBe('lost?!');
	});

	it('reports a transaction that aborts (quota errors arrive this way)', async () => {
		quiet();
		const name = fresh();
		const doc = new Y.Doc();
		const saver = await BoardSaver.open(name, doc);
		const original = IDBObjectStore.prototype.add;
		vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementationOnce(function (
			this: IDBObjectStore,
			...args
		) {
			const req = original.apply(this, args);
			this.transaction.abort();
			return req;
		});
		doc.getText('t').insert(0, 'x');
		await settle();
		expect(saver.state.kind).toBe('failed');
		await saver.destroy();
	});

	it('a failed retry stays failed', async () => {
		quiet();
		const doc = new Y.Doc();
		const saver = await BoardSaver.open(fresh(), doc);
		vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(() => {
			throw new DOMException('Full', 'QuotaExceededError');
		});
		doc.getText('t').insert(0, 'x');
		await settle();
		expect(await saver.retry()).toBe(false);
		expect(saver.state.kind).toBe('failed');
		vi.restoreAllMocks();
		quiet();
		expect(await saver.retry()).toBe(true);
		await saver.destroy();
	});

	it('rejects when the database can’t be opened', async () => {
		vi.spyOn(indexedDB, 'open').mockImplementation(() => {
			throw new DOMException('Denied', 'SecurityError');
		});
		await expect(BoardSaver.open(fresh(), new Y.Doc())).rejects.toThrow('Denied');
	});

	it('merges stored updates into one, keeping updates other tabs stored meanwhile', async () => {
		const name = fresh();
		const doc = new Y.Doc();
		const saver = await BoardSaver.open(name, doc);
		const other = new Y.Doc();
		const otherSaver = await BoardSaver.open(name, other);
		other.getText('o').insert(0, 'other tab');
		await settle();

		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		for (let i = 0; i < COMPACT_AT; i++) doc.getText('t').insert(0, 'a');
		vi.useRealTimers();
		await settle();
		expect(await saver.retry()).toBe(true); // compacts now
		const db = await new Promise<IDBDatabase>((resolve) => {
			const req = indexedDB.open(name);
			req.onsuccess = () => resolve(req.result);
		});
		const count = await new Promise<number>((resolve) => {
			const req = db.transaction('updates').objectStore('updates').count();
			req.onsuccess = () => resolve(req.result);
		});
		db.close();
		expect(count).toBe(1);
		expect(doc.getText('o').toString()).toBe('other tab');
		await saver.destroy();
		await otherSaver.destroy();
		expect(await stored(name)).toBe('a'.repeat(COMPACT_AT));
	});

	it('reads boards stored by y-indexeddb, and y-indexeddb reads what it stores', async () => {
		const name = fresh();
		const legacy = new Y.Doc();
		const p = new IndexeddbPersistence(name, legacy);
		await p.whenSynced;
		legacy.getText('t').insert(0, 'old');
		await settle();
		await p.destroy();

		const doc = new Y.Doc();
		const saver = await BoardSaver.open(name, doc);
		expect(doc.getText('t').toString()).toBe('old');
		doc.getText('t').insert(3, ' and new');
		await saver.retry();
		await saver.destroy();

		const back = new Y.Doc();
		const p2 = new IndexeddbPersistence(name, back);
		await p2.whenSynced;
		expect(back.getText('t').toString()).toBe('old and new');
		await p2.destroy();
	});
});
