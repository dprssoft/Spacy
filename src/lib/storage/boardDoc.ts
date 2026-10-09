import { getCommentsMap } from '$lib/model/comments';
import { ensureOutlineMap } from '$lib/model/outline';
import { deleteDB } from 'idb';
import { IndexeddbPersistence } from 'y-indexeddb';
import * as Y from 'yjs';
import { getDocsMap, getMeta, getSketchesMap } from '$lib/model/doc';
import { migrate } from '$lib/model/migrations';
import { allPageMaps, pruneOrphanThreads } from '$lib/model/pages';
import { IMPORT, LOCAL, MIGRATION, REMOTE_SYNC, type Origin } from '$lib/model/origins';
import { debounce } from '$lib/shared/debounce';
import { BoardSaver } from './boardSaver';
import { boardDbName } from './db';
import * as assetsRepo from './assetsRepo';
import * as boardsRepo from './boardsRepo';
import { markDirty, trackOpenBoard } from './sync/hub';
import { createTabSync } from './tabSync';
import type { BoardMeta } from './types';

export { boardDbName };
export const boardChannelName = (id: string): string => `spacy-board-${id}`;

export class BoardNotFoundError extends Error {
	constructor(readonly id: string) {
		super(`Board ${id} not found`);
		this.name = 'BoardNotFoundError';
	}
}

export interface OpenBoard {
	id: string;
	doc: Y.Doc;
	undo: Y.UndoManager;
	/** Whether changes are reaching storage; retry after a failure. */
	saver: BoardSaver;
	close(): Promise<void>;
}

const TOUCH_UPDATED_MS = 2000;

/** Loads a board for live editing. The only place that wires providers to a board's Y.Doc. */
export async function openBoard(id: string): Promise<OpenBoard> {
	const meta = await boardsRepo.get(id);
	if (!meta) throw new BoardNotFoundError(id);

	const doc = new Y.Doc();
	const saver = await BoardSaver.open(boardDbName(id), doc);

	try {
		migrate(doc);
	} catch (err) {
		await saver.destroy();
		doc.destroy();
		throw err;
	}
	if (typeof getMeta(doc).get('title') !== 'string') {
		doc.transact(() => getMeta(doc).set('title', meta.title), MIGRATION);
	}
	pruneOrphanThreads(doc, MIGRATION);

	const stopTabSync = createTabSync(doc, boardChannelName(id));
	const untrackSync = trackOpenBoard(id, doc);
	ensureOutlineMap(doc);
	const undo = createBoardUndo(doc);

	const touch = debounce(() => boardsRepo.touchUpdated(id), TOUCH_UPDATED_MS);
	const onUpdate = (_update: Uint8Array, origin: unknown) => {
		if (origin === LOCAL) touch();
	};
	doc.on('update', onUpdate);

	let closed = false;
	return {
		id,
		doc,
		undo,
		saver,
		async close() {
			if (closed) return;
			closed = true;
			doc.off('update', onUpdate);
			await touch.flush();
			undo.destroy();
			untrackSync();
			stopTabSync();
			await saver.destroy();
			doc.destroy();
		}
	};
}

/** The board's full content as one Yjs update (read-only; no live providers). */
export async function loadSnapshot(id: string): Promise<Uint8Array> {
	const doc = new Y.Doc();
	const persistence = new IndexeddbPersistence(boardDbName(id), doc);
	await persistence.whenSynced;
	const update = Y.encodeStateAsUpdate(doc);
	await persistence.destroy();
	doc.destroy();
	return update;
}

/** Merges `update` into a board's stored content. */
export async function writeSnapshot(
	id: string,
	update: Uint8Array,
	origin: Origin = IMPORT
): Promise<void> {
	const doc = new Y.Doc();
	Y.applyUpdate(doc, update, origin);
	// y-indexeddb stores the doc's existing state when it first syncs.
	const persistence = new IndexeddbPersistence(boardDbName(id), doc);
	await persistence.whenSynced;
	await persistence.destroy();
	doc.destroy();
	if (origin !== REMOTE_SYNC) markDirty(id);
}

/** Deletes a board's stored content. Open connections in other tabs close themselves. */
export async function deleteBoardData(id: string): Promise<void> {
	await deleteDB(boardDbName(id));
}

/** Creates an independent copy of a board: content, images (new asset ids) and thumbnail. */
export async function duplicateBoard(id: string): Promise<BoardMeta> {
	const src = await boardsRepo.get(id);
	if (!src) throw new BoardNotFoundError(id);

	const title = `${src.title} (copy)`;
	const meta = await boardsRepo.create({ title });
	const assetMap = await assetsRepo.copyToBoard(id, meta.id);

	const doc = new Y.Doc();
	Y.applyUpdate(doc, await loadSnapshot(id), IMPORT);
	doc.transact(() => {
		// Images on every page point at the copied assets.
		for (const map of allPageMaps(doc))
			for (const ymap of map.values()) {
				const next =
					ymap.get('type') === 'image' ? assetMap.get(String(ymap.get('assetId'))) : null;
				if (next) ymap.set('assetId', next);
			}
		getMeta(doc).set('title', title);
	}, IMPORT);
	await writeSnapshot(meta.id, Y.encodeStateAsUpdate(doc));
	doc.destroy();

	if (src.thumbnail) await boardsRepo.setThumbnail(meta.id, src.thumbnail);
	return (await boardsRepo.get(meta.id)) ?? meta;
}

/**
 * Canvas undo (D10): tracks only LOCAL transactions. Doc card text edits come from the editor's
 * Yjs binding (another origin) and have their own editor undo. The `docs` map is in scope so that
 * undoing the creation or deletion of a card also removes or restores its content (they change in
 * the same LOCAL transaction as the element).
 */
export function createBoardUndo(doc: Y.Doc): Y.UndoManager {
	// Every page is in scope; pages added later join through `undo.addToScope` (board/pages).
	const outline = getMeta(doc).get('outline');
	return new Y.UndoManager(
		[
			...allPageMaps(doc),
			getDocsMap(doc),
			getSketchesMap(doc),
			getCommentsMap(doc),
			...(outline instanceof Y.Map ? [outline] : [])
		],
		{
			trackedOrigins: new Set([LOCAL]),
			captureTimeout: 500
		}
	);
}
