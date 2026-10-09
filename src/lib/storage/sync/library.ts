// The board list, synced between devices as its own Yjs doc ("library"). The start page keeps
// reading the local `boards` store (D3); `reconcile` keeps the two in step, both ways.
import { IndexeddbPersistence } from 'y-indexeddb';
import * as Y from 'yjs';
import { LOCAL } from '$lib/model/origins';
import { SYNCING_TITLE } from '../boardsRepo';
import type { BoardMeta } from '../types';
import type { SyncStateStore } from './engine';

export { SYNCING_TITLE };

export const LIBRARY_ID = 'library';
export const LIBRARY_DB = 'spacy-library';

/** What syncs per board. Title lives in the board doc; opened time, viewport and thumbnail stay local. */
export interface LibraryFields {
	createdAt: number;
	starred: boolean;
	deletedAt: number | null;
}
interface Entry extends LibraryFields {
	/** Deleted forever: a tombstone, kept so a device back after months doesn't bring it back. */
	purgedAt: number | null;
}

/** The local board list, as the reconciler needs it. */
export interface LocalList {
	all(): Promise<BoardMeta[]>;
	create(id: string, fields: LibraryFields, title: string): Promise<void>;
	update(id: string, fields: Partial<LibraryFields>): Promise<void>;
	/** Deletes a board's local data (content, metadata, images), whether or not it's listed. */
	destroy(id: string): Promise<void>;
	/** The title stored in a board's content, if it has any. */
	title(id: string): Promise<string | null>;
}

const SHADOW_KEY = 'library:shadow';
type Shadow = Record<string, Entry>;

export function libraryBoards(doc: Y.Doc): Y.Map<Y.Map<unknown>> {
	return doc.getMap('boards');
}

function readEntry(m: Y.Map<unknown> | undefined): Entry | null {
	if (!m) return null;
	const num = (k: string) => (typeof m.get(k) === 'number' ? (m.get(k) as number) : null);
	return {
		createdAt: num('createdAt') ?? 0,
		starred: m.get('starred') === true,
		deletedAt: num('deletedAt'),
		purgedAt: num('purgedAt')
	};
}

export function readLibrary(doc: Y.Doc): Map<string, Entry> {
	const out = new Map<string, Entry>();
	for (const [id, m] of libraryBoards(doc)) {
		const e = readEntry(m);
		if (e) out.set(id, e);
	}
	return out;
}

export function purgedIds(doc: Y.Doc): Set<string> {
	const out = new Set<string>();
	for (const [id, e] of readLibrary(doc)) if (e.purgedAt !== null) out.add(id);
	return out;
}

function writeEntry(doc: Y.Doc, id: string, change: Partial<Entry>): void {
	const boards = libraryBoards(doc);
	let m = boards.get(id);
	if (!m) {
		m = new Y.Map();
		boards.set(id, m);
	}
	for (const [k, v] of Object.entries(change)) if (m.get(k) !== v) m.set(k, v);
}

const fieldsOf = (b: BoardMeta): LibraryFields => ({
	createdAt: b.createdAt,
	starred: b.starred,
	deletedAt: b.deletedAt
});

/**
 * Brings the local list and the library doc together, both ways. A per-board "shadow" (both sides
 * as of the last reconcile) tells which side changed a field; when both did, the library's merged
 * value wins. Idempotent. Returns whether the library doc changed (it then needs uploading).
 */
export async function reconcile(
	doc: Y.Doc,
	list: LocalList,
	state: SyncStateStore,
	now = Date.now()
): Promise<boolean> {
	const stored = await state.get(SHADOW_KEY);
	const shadow: Shadow = stored && typeof stored === 'object' ? { ...(stored as Shadow) } : {};
	const local = new Map((await list.all()).map((b) => [b.id, b]));
	const lib = readLibrary(doc);
	const ids = new Set([...local.keys(), ...lib.keys(), ...Object.keys(shadow)]);
	const libChanges = new Map<string, Partial<Entry>>();

	for (const id of ids) {
		const L = local.get(id);
		const R = lib.get(id) ?? null;
		const S = shadow[id] ?? null;

		if (R?.purgedAt != null) {
			if (L || !S || S.purgedAt === null) await list.destroy(id);
			shadow[id] = R;
			continue;
		}
		if (!L) {
			if (S && R) {
				// Deleted forever here (or expired from the trash): leave a tombstone.
				libChanges.set(id, { purgedAt: now });
				shadow[id] = { ...R, purgedAt: now };
			} else if (R) {
				const title = (await list.title(id)) ?? SYNCING_TITLE;
				await list.create(id, R, title);
				shadow[id] = R;
			} else {
				delete shadow[id];
			}
			continue;
		}
		const mine = fieldsOf(L);
		if (!R) {
			libChanges.set(id, { ...mine, purgedAt: null });
			shadow[id] = { ...mine, purgedAt: null };
			continue;
		}
		const merged: LibraryFields = { ...R };
		const pull: Partial<LibraryFields> = {};
		const push: Partial<LibraryFields> = {};
		const pick = <K extends 'starred' | 'deletedAt'>(
			k: K,
			firstConnect: () => LibraryFields[K]
		) => {
			const v: LibraryFields[K] = S
				? mine[k] !== S[k] && R[k] === S[k]
					? mine[k]
					: R[k]
				: firstConnect();
			merged[k] = v;
			if (v !== R[k]) push[k] = v;
			if (v !== mine[k]) pull[k] = v;
		};
		// First connect: nothing is lost — a star on either side stays, and a board is in the
		// trash only if it is on both.
		pick('starred', () => mine.starred || R.starred);
		pick('deletedAt', () =>
			mine.deletedAt !== null && R.deletedAt !== null ? Math.max(mine.deletedAt, R.deletedAt) : null
		);
		if (Object.keys(pull).length > 0) await list.update(id, pull);
		if (Object.keys(push).length > 0) libChanges.set(id, push);
		shadow[id] = { ...merged, purgedAt: null };
	}

	if (libChanges.size > 0) {
		doc.transact(() => {
			for (const [id, change] of libChanges) writeEntry(doc, id, change);
		}, LOCAL);
	}
	await state.set(SHADOW_KEY, shadow);
	return libChanges.size > 0;
}

/** Loads the library doc of this browser; it saves itself while open. */
export async function openLibrary(): Promise<{ doc: Y.Doc; close(): Promise<void> }> {
	const doc = new Y.Doc();
	const persistence = new IndexeddbPersistence(LIBRARY_DB, doc);
	await persistence.whenSynced;
	return {
		doc,
		async close() {
			await persistence.destroy();
			doc.destroy();
		}
	};
}
