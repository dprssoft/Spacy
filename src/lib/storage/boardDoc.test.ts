import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { getElement, getElementsMap, getMeta, listElements } from '$lib/model/doc';
import { NewerSchemaError, SCHEMA_VERSION } from '$lib/model/migrations';
import { createElements, updateElement } from '$lib/model/ops';
import { LOCAL, REMOTE_TAB } from '$lib/model/origins';
import { samples } from '$lib/model/testFixtures';
import * as assetsRepo from './assetsRepo';
import {
	BoardNotFoundError,
	boardDbName,
	duplicateBoard,
	loadSnapshot,
	openBoard,
	writeSnapshot
} from './boardDoc';
import { destroyBoard, purgeExpiredTrash } from './boardLifecycle';
import * as boardsRepo from './boardsRepo';
import { freshDB } from './testUtils';

beforeEach(freshDB);

async function dbExists(name: string): Promise<boolean> {
	return (await indexedDB.databases()).some((d) => d.name === name);
}

describe('openBoard', () => {
	it('persists edits across close and reopen, and stamps schema and title', async () => {
		const { id } = await boardsRepo.create({ title: 'Plan' });
		const first = await openBoard(id);
		createElements(first.doc, [samples.shape('s1')]);
		await first.close();

		const second = await openBoard(id);
		expect(getElement(second.doc, 's1')?.type).toBe('shape');
		expect(getMeta(second.doc).get('schemaVersion')).toBe(SCHEMA_VERSION);
		expect(getMeta(second.doc).get('title')).toBe('Plan');
		await second.close();
	});

	it('throws BoardNotFoundError for unknown boards', async () => {
		await expect(openBoard('missing')).rejects.toBeInstanceOf(BoardNotFoundError);
	});

	it('rejects boards from a newer schema version', async () => {
		const { id } = await boardsRepo.create();
		const doc = new Y.Doc();
		getMeta(doc).set('schemaVersion', SCHEMA_VERSION + 1);
		await writeSnapshot(id, Y.encodeStateAsUpdate(doc));
		await expect(openBoard(id)).rejects.toBeInstanceOf(NewerSchemaError);
	});

	it('marks the board as updated after local edits only', async () => {
		const { id } = await boardsRepo.create();
		const board = await openBoard(id);
		const touch = vi.spyOn(boardsRepo, 'touchUpdated');

		const remote = new Y.Doc();
		getElementsMap(remote); // same type layout
		createElements(remote, [samples.sticky('r1')]);
		Y.applyUpdate(board.doc, Y.encodeStateAsUpdate(remote), REMOTE_TAB);
		expect(touch).not.toHaveBeenCalled();

		createElements(board.doc, [samples.shape('l1')]);
		expect(touch).not.toHaveBeenCalled(); // debounced
		await board.close(); // flushes the pending touch
		expect(touch).toHaveBeenCalledExactlyOnceWith(id);
		touch.mockRestore();
	});

	it('undoes local edits but not edits from other tabs', async () => {
		const { id } = await boardsRepo.create();
		const board = await openBoard(id);

		const remote = new Y.Doc();
		createElements(remote, [samples.sticky('remote')]);
		Y.applyUpdate(board.doc, Y.encodeStateAsUpdate(remote), REMOTE_TAB);
		createElements(board.doc, [samples.shape('local')]);
		updateElement(board.doc, 'local', { x: 500 });

		board.undo.undo();
		expect(getElement(board.doc, 'local')).toBeNull();
		expect(getElement(board.doc, 'remote')).not.toBeNull();
		expect(board.undo.canUndo()).toBe(false);
		await board.close();
	});

	it('does not track meta changes in canvas undo', async () => {
		const { id } = await boardsRepo.create();
		const board = await openBoard(id);
		board.doc.transact(() => getMeta(board.doc).set('title', 'X'), LOCAL);
		expect(board.undo.canUndo()).toBe(false);
		await board.close();
	});

	it('closing twice is harmless', async () => {
		const { id } = await boardsRepo.create();
		const board = await openBoard(id);
		await board.close();
		await expect(board.close()).resolves.toBeUndefined();
	});
});

describe('snapshots', () => {
	it('writes and loads a board snapshot', async () => {
		const { id } = await boardsRepo.create();
		const doc = new Y.Doc();
		createElements(doc, [samples.text('t1')]);
		await writeSnapshot(id, Y.encodeStateAsUpdate(doc));

		const loaded = new Y.Doc();
		Y.applyUpdate(loaded, await loadSnapshot(id));
		expect(getElement(loaded, 't1')?.type).toBe('text');
	});
});

describe('duplicateBoard', () => {
	it('copies content, remaps image assets, copies the thumbnail, and stays independent', async () => {
		const src = await boardsRepo.create({ title: 'Roadmap' });
		const assetId = await assetsRepo.put(src.id, new Blob(['img'], { type: 'image/png' }), {
			width: 10,
			height: 10
		});
		await boardsRepo.setThumbnail(src.id, new Blob(['thumb']));
		const board = await openBoard(src.id);
		createElements(board.doc, [samples.shape('s1'), { ...samples.image('i1'), assetId }]);
		await board.close();

		const copy = await duplicateBoard(src.id);
		expect(copy.title).toBe('Roadmap (copy)');
		expect(copy.thumbnail?.size).toBe(5);

		const opened = await openBoard(copy.id);
		const els = listElements(opened.doc);
		expect(els.map((e) => e.id).sort()).toEqual(['i1', 's1']);
		const image = getElement(opened.doc, 'i1');
		expect(image?.type === 'image' && image.assetId).not.toBe(assetId);
		expect(image?.type === 'image' && (await assetsRepo.get(image.assetId))?.boardId).toBe(copy.id);
		expect(getMeta(opened.doc).get('title')).toBe('Roadmap (copy)');

		updateElement(opened.doc, 's1', { x: 999 });
		await opened.close();
		const original = await openBoard(src.id);
		expect(getElement(original.doc, 's1')?.x).toBe(10);
		await original.close();
	});

	it('throws for unknown boards', async () => {
		await expect(duplicateBoard('missing')).rejects.toBeInstanceOf(BoardNotFoundError);
	});
});

describe('boardLifecycle', () => {
	it('destroyBoard removes metadata, assets and stored content', async () => {
		const { id } = await boardsRepo.create();
		await assetsRepo.put(id, new Blob(['x']), { width: 1, height: 1 });
		const board = await openBoard(id);
		createElements(board.doc, [samples.shape('s1')]);
		await board.close();
		expect(await dbExists(boardDbName(id))).toBe(true);

		await destroyBoard(id);
		expect(await boardsRepo.get(id)).toBeUndefined();
		expect(await assetsRepo.listByBoard(id)).toEqual([]);
		expect(await dbExists(boardDbName(id))).toBe(false);
	});

	it('purgeExpiredTrash fully destroys only expired boards', async () => {
		const old = await boardsRepo.create();
		const keep = await boardsRepo.create();
		await boardsRepo.trash(old.id);
		await (await openBoard(old.id)).close();
		const purged = await purgeExpiredTrash(Date.now() + 31 * 24 * 60 * 60 * 1000);
		expect(purged).toEqual([old.id]);
		expect(await dbExists(boardDbName(old.id))).toBe(false);
		expect(await boardsRepo.get(keep.id)).toBeDefined();
	});
});

describe('two tabs', () => {
	it('keeps two open copies of a board in sync', async () => {
		const { id } = await boardsRepo.create();
		const a = await openBoard(id);
		const b = await openBoard(id);
		createElements(a.doc, [samples.sticky('from-a')]);
		await vi.waitFor(() => expect(getElement(b.doc, 'from-a')).not.toBeNull());
		// Changes from the other tab are not undoable here.
		expect(b.undo.canUndo()).toBe(false);
		await a.close();
		await b.close();
	});
});
