import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import * as Y from 'yjs';

// Live persistence of an open board. The stored layout is y-indexeddb's (an `updates` store of
// Yjs updates under auto-increment keys, plus an unused `custom` store), so snapshots read and
// written with y-indexeddb stay compatible. Unlike y-indexeddb, every write is awaited: a full
// disk or a connection the browser closed is reported instead of failing silently.

export type SaveState = { kind: 'saved' } | { kind: 'failed'; error: unknown };

interface BoardDB extends DBSchema {
	updates: { key: number; value: Uint8Array };
	custom: { key: string; value: unknown };
}

/** Same threshold as y-indexeddb: merge stored updates into one once there are this many. */
export const COMPACT_AT = 500;
const COMPACT_DELAY_MS = 1000;

const openBoardDB = (name: string, onClose: () => void) =>
	openDB<BoardDB>(name, 1, {
		upgrade(db) {
			db.createObjectStore('updates', { autoIncrement: true });
			db.createObjectStore('custom');
		},
		// Another tab deletes the board's data: let it.
		blocking(_current, _next, event) {
			(event.target as IDBDatabase).close();
			onClose();
		},
		terminated: onClose
	});

export class BoardSaver {
	state: SaveState = { kind: 'saved' };
	readonly #name: string;
	readonly #doc: Y.Doc;
	#db: IDBPDatabase<BoardDB> | null = null;
	#count = 0;
	#compactTimer: ReturnType<typeof setTimeout> | undefined;
	#listeners = new Set<(state: SaveState) => void>();
	#destroyed = false;
	readonly #onUpdate = (update: Uint8Array, origin: unknown) => {
		if (origin !== this) void this.#write(update);
	};

	private constructor(name: string, doc: Y.Doc) {
		this.#name = name;
		this.#doc = doc;
	}

	/** Loads the stored board into `doc` and saves its updates from then on. */
	static async open(name: string, doc: Y.Doc): Promise<BoardSaver> {
		const saver = new BoardSaver(name, doc);
		const db = await saver.#connect();
		const updates = await db.getAll('updates');
		Y.transact(doc, () => updates.forEach((u) => Y.applyUpdate(doc, u)), saver, false);
		saver.#count = updates.length;
		doc.on('update', saver.#onUpdate);
		return saver;
	}

	subscribe(fn: (state: SaveState) => void): () => void {
		this.#listeners.add(fn);
		return () => this.#listeners.delete(fn);
	}

	/**
	 * Saves the whole board again, reconnecting if needed. An update that failed is missing from
	 * storage, so later updates alone wouldn't bring the board back on reload.
	 */
	async retry(): Promise<boolean> {
		if (this.#destroyed) return false;
		try {
			await this.#compact();
		} catch (error) {
			this.#fail(error);
			return false;
		}
		this.#set({ kind: 'saved' });
		return true;
	}

	async destroy(): Promise<void> {
		if (this.#destroyed) return;
		this.#destroyed = true;
		clearTimeout(this.#compactTimer);
		this.#doc.off('update', this.#onUpdate);
		this.#listeners.clear();
		this.#db?.close();
		this.#db = null;
	}

	async #connect(): Promise<IDBPDatabase<BoardDB>> {
		if (this.#db) return this.#db;
		const db = await openBoardDB(this.#name, () => {
			if (this.#db === db) this.#db = null;
		});
		this.#db = db;
		return db;
	}

	async #write(update: Uint8Array): Promise<void> {
		try {
			const db = this.#db;
			if (!db) throw new Error('Storage connection closed');
			const tx = db.transaction('updates', 'readwrite');
			await Promise.all([tx.store.add(update), tx.done]);
		} catch (error) {
			this.#fail(error);
			return;
		}
		if (++this.#count >= COMPACT_AT) {
			clearTimeout(this.#compactTimer);
			this.#compactTimer = setTimeout(() => {
				// A failed merge loses nothing: the separate updates are still stored.
				if (!this.#destroyed) this.#compact().catch(() => {});
			}, COMPACT_DELAY_MS);
		}
	}

	/**
	 * Replaces the stored updates with the board's full state, in one transaction. Updates stored
	 * meanwhile by other tabs are merged in first, so none are dropped.
	 */
	async #compact(): Promise<void> {
		const db = await this.#connect();
		const tx = db.transaction('updates', 'readwrite');
		const done = tx.done;
		try {
			const stored = await tx.store.getAll();
			Y.transact(this.#doc, () => stored.forEach((u) => Y.applyUpdate(this.#doc, u)), this, false);
			const key = await tx.store.add(Y.encodeStateAsUpdate(this.#doc));
			await tx.store.delete(IDBKeyRange.upperBound(key, true));
		} catch (error) {
			done.catch(() => {});
			throw error;
		}
		await done;
		this.#count = 1;
	}

	#fail(error: unknown): void {
		if (this.#destroyed) return;
		console.error('Saving the board failed', error);
		this.#set({ kind: 'failed', error });
	}

	#set(state: SaveState): void {
		if (this.state.kind === state.kind) return;
		this.state = state;
		for (const fn of this.#listeners) fn(state);
	}
}
