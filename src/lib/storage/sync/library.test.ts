import { beforeEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { getMeta } from '$lib/model/doc';
import { LOCAL, REMOTE_SYNC } from '$lib/model/origins';
import * as boardsRepo from '../boardsRepo';
import { readTitle } from '../boardDoc';
import { destroyBoard, renameBoard } from '../boardLifecycle';
import { freshDB } from '../testUtils';
import type { BoardMeta } from '../types';
import { SyncEngine, type SyncLocal, type SyncStateStore } from './engine';
import { idbLocalList, idbSyncState } from './idbLocal';
import { LIBRARY_ID, SYNCING_TITLE, readLibrary, reconcile, type LocalList } from './library';
import { MemoryRemoteStore } from './remote';

/** A simulated browser: board list, board contents, library doc and sync bookkeeping. */
class Device {
	readonly boards = new Map<string, BoardMeta>();
	readonly contents = new Map<string, Y.Doc>();
	readonly library = new Y.Doc();
	readonly saved = new Map<string, unknown>();
	readonly engine: SyncEngine;
	readonly list: LocalList;
	readonly state: SyncStateStore;
	private clock = 1000;

	constructor(store: MemoryRemoteStore, device: string) {
		this.list = {
			all: async () => [...this.boards.values()].map((b) => ({ ...b })),
			create: async (id, fields, title) => this.put({ ...this.blank(id), ...fields, title }),
			update: async (id, fields) => {
				const b = this.boards.get(id);
				if (b) this.boards.set(id, { ...b, ...fields });
			},
			destroy: async (id) => {
				this.boards.delete(id);
				this.contents.delete(id);
			},
			title: async (id) => {
				const t = this.contents.get(id) && getMeta(this.content(id)).get('title');
				return typeof t === 'string' ? t : null;
			}
		};
		this.state = {
			get: async (k) => structuredClone(this.saved.get(k)),
			set: async (k, v) => void this.saved.set(k, structuredClone(v))
		};
		const local: SyncLocal = {
			boardIds: async () => [LIBRARY_ID, ...this.boards.keys()],
			read: async (id) =>
				Y.encodeStateAsUpdate(id === LIBRARY_ID ? this.library : this.content(id)),
			apply: async (id, update) => {
				Y.applyUpdate(id === LIBRARY_ID ? this.library : this.content(id), update, REMOTE_SYNC);
				const b = this.boards.get(id);
				const t = await this.list.title(id);
				if (b && t) this.boards.set(id, { ...b, title: t });
			},
			purgedBoards: async () =>
				new Set([...readLibrary(this.library)].filter(([, e]) => e.purgedAt).map(([id]) => id)),
			afterDownload: async () =>
				(await reconcile(this.library, this.list, this.state, this.now())) ? [LIBRARY_ID] : []
		};
		this.engine = new SyncEngine({ store, local, state: this.state, device });
	}

	now(): number {
		return ++this.clock;
	}

	private blank(id: string): BoardMeta {
		return {
			id,
			title: 'Untitled board',
			createdAt: this.now(),
			updatedAt: 0,
			openedAt: 0,
			starred: false,
			deletedAt: null,
			thumbnail: null,
			viewport: null
		};
	}

	private put(b: BoardMeta): void {
		this.boards.set(b.id, b);
	}

	content(id: string): Y.Doc {
		let doc = this.contents.get(id);
		if (!doc) {
			doc = new Y.Doc();
			this.contents.set(id, doc);
		}
		return doc;
	}

	create(id: string, title: string): void {
		this.put({ ...this.blank(id), title });
		this.rename(id, title);
	}

	rename(id: string, title: string): void {
		const doc = this.content(id);
		doc.transact(() => getMeta(doc).set('title', title), LOCAL);
		const b = this.boards.get(id);
		if (b) this.boards.set(id, { ...b, title });
	}

	patch(id: string, change: Partial<BoardMeta>): void {
		const b = this.boards.get(id);
		if (b) this.boards.set(id, { ...b, ...change });
	}

	purge(id: string): void {
		this.boards.delete(id);
		this.contents.delete(id);
	}

	sync(): Promise<void> {
		return this.engine.cycle();
	}

	view(id: string) {
		const b = this.boards.get(id);
		return b && { title: b.title, starred: b.starred, trashed: b.deletedAt !== null };
	}
}

function setup() {
	const store = new MemoryRemoteStore();
	return { store, a: new Device(store, 'A'), b: new Device(store, 'B') };
}

describe('board list sync', () => {
	it('create, rename, star, trash, restore and purge on A arrive on B', async () => {
		const { store, a, b } = setup();
		a.create('x', 'Plan');
		await a.sync();
		await b.sync();
		expect(b.view('x')).toEqual({ title: 'Plan', starred: false, trashed: false });

		a.rename('x', 'Roadmap');
		a.patch('x', { starred: true });
		await a.sync();
		await b.sync();
		expect(b.view('x')).toEqual({ title: 'Roadmap', starred: true, trashed: false });

		a.patch('x', { deletedAt: a.now() });
		await a.sync();
		await b.sync();
		expect(b.view('x')?.trashed).toBe(true);

		a.patch('x', { deletedAt: null });
		await a.sync();
		await b.sync();
		expect(b.view('x')?.trashed).toBe(false);

		a.purge('x');
		await a.sync();
		await b.sync();
		expect(b.view('x')).toBeUndefined();
		expect(b.contents.has('x')).toBe(false);
		await a.sync();
		expect(store.list().filter((f) => f.props.board === 'x')).toEqual([]);
	});

	it('applies a star on A and a trash on B made at the same time', async () => {
		const { a, b } = setup();
		a.create('x', 'Plan');
		await a.sync();
		await b.sync();
		a.patch('x', { starred: true });
		b.patch('x', { deletedAt: b.now() });
		await a.sync();
		await b.sync();
		await a.sync();
		expect(a.view('x')).toEqual({ title: 'Plan', starred: true, trashed: true });
		expect(b.view('x')).toEqual({ title: 'Plan', starred: true, trashed: true });
	});

	it('a purge beats a later edit from a device that was offline', async () => {
		const { store, a, b } = setup();
		a.create('x', 'Plan');
		await a.sync();
		await b.sync();
		a.purge('x');
		await a.sync();
		// B edits while offline, then comes back.
		b.rename('x', 'Edited offline');
		b.patch('x', { starred: true });
		await b.sync();
		expect(b.view('x')).toBeUndefined();
		await a.sync();
		expect(a.view('x')).toBeUndefined();
		expect(store.list().filter((f) => f.props.board === 'x')).toEqual([]);
	});

	it('merges two existing lists on first connect', async () => {
		const { a, b } = setup();
		a.create('mine', 'From A');
		b.create('theirs', 'From B');
		await a.sync();
		await b.sync();
		await a.sync();
		expect(a.view('theirs')?.title).toBe('From B');
		expect(b.view('mine')?.title).toBe('From A');
	});

	it('shows a placeholder title until a board’s content arrives', async () => {
		const { store, a, b } = setup();
		a.create('x', 'Plan');
		await a.sync();
		const isX = (id: string) => store.list().find((f) => f.id === id)?.props.board === 'x';
		store.failWhen = (op, id) => op === 'read' && isX(id);
		await expect(b.sync()).rejects.toThrow();
		expect(b.view('x')?.title).toBe(SYNCING_TITLE);
		store.failWhen = null;
		await b.sync();
		expect(b.view('x')?.title).toBe('Plan');
	});

	it('reconciling twice changes nothing more', async () => {
		const { a } = setup();
		a.create('x', 'Plan');
		a.patch('x', { starred: true });
		expect(await reconcile(a.library, a.list, a.state)).toBe(true);
		expect(await reconcile(a.library, a.list, a.state)).toBe(false);
		expect(a.view('x')).toEqual({ title: 'Plan', starred: true, trashed: false });
	});
});

describe('board list sync with IndexedDB', () => {
	beforeEach(freshDB);

	it('local board list writes reach the library, deletions as tombstones', async () => {
		const library = new Y.Doc();
		const meta = await boardsRepo.create({ title: 'Plan' });
		await reconcile(library, idbLocalList, idbSyncState);
		expect(readLibrary(library).get(meta.id)).toMatchObject({ starred: false, purgedAt: null });

		await boardsRepo.setStarred(meta.id, true);
		await reconcile(library, idbLocalList, idbSyncState);
		expect(readLibrary(library).get(meta.id)?.starred).toBe(true);

		await destroyBoard(meta.id);
		await reconcile(library, idbLocalList, idbSyncState, 5000);
		expect(readLibrary(library).get(meta.id)?.purgedAt).toBe(5000);
	});

	it('boards from another device are listed with their id', async () => {
		const library = new Y.Doc();
		library.transact(() => {
			const m = new Y.Map<unknown>();
			library.getMap('boards').set('remote1', m);
			m.set('createdAt', 1);
			m.set('starred', true);
			m.set('deletedAt', null);
			m.set('purgedAt', null);
		});
		await reconcile(library, idbLocalList, idbSyncState);
		expect(await boardsRepo.get('remote1')).toMatchObject({
			title: SYNCING_TITLE,
			createdAt: 1,
			starred: true
		});
	});

	it('renaming from the start page writes the title into the board content', async () => {
		const meta = await boardsRepo.create({ title: 'Plan' });
		await renameBoard(meta.id, ' Roadmap ');
		expect((await boardsRepo.get(meta.id))?.title).toBe('Roadmap');
		expect(await readTitle(meta.id)).toBe('Roadmap');
	});
});
