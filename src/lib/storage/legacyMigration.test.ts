import { deleteDB, openDB } from 'idb';
import { beforeEach, describe, expect, it } from 'vitest';
import { IndexeddbPersistence } from 'y-indexeddb';
import * as Y from 'yjs';
import * as assetsRepo from './assetsRepo';
import { loadSnapshot } from './boardDoc';
import * as boardsRepo from './boardsRepo';
import { boardDbName, DB_NAME, getDB, resetDBForTests } from './db';
import { LEGACY_DB_NAME, legacyBoardDbName } from './legacyMigration';
import type { AssetRecord, BoardMeta } from './types';

const dbExists = async (name: string) => (await indexedDB.databases()).some((d) => d.name === name);

const meta = (id: string, title: string): BoardMeta => ({
	id,
	title,
	createdAt: 1,
	updatedAt: 2,
	openedAt: 3,
	starred: true,
	deletedAt: null,
	thumbnail: null,
	viewport: { x: 10, y: 20, zoom: 2 }
});

/** The board list as SMTHNG stored it (same schema as `db.ts`). */
async function legacyBoardList(boards: BoardMeta[], assets: AssetRecord[] = []): Promise<void> {
	const db = await openDB(LEGACY_DB_NAME, 1, {
		upgrade(db) {
			const b = db.createObjectStore('boards', { keyPath: 'id' });
			b.createIndex('openedAt', 'openedAt');
			b.createIndex('updatedAt', 'updatedAt');
			b.createIndex('deletedAt', 'deletedAt');
			const a = db.createObjectStore('assets', { keyPath: 'id' });
			a.createIndex('boardId', 'boardId');
		}
	});
	for (const board of boards) await db.put('boards', board);
	for (const asset of assets) await db.put('assets', asset);
	db.close();
}

/** A board's content as SMTHNG stored it (y-indexeddb), in several updates. */
async function legacyBoardContent(id: string, texts: string[]): Promise<void> {
	const doc = new Y.Doc();
	const persistence = new IndexeddbPersistence(legacyBoardDbName(id), doc);
	await persistence.whenSynced;
	for (const text of texts) doc.getArray<string>('texts').push([text]);
	// y-indexeddb stores each update asynchronously.
	await new Promise((r) => setTimeout(r, 50));
	await persistence.destroy();
	doc.destroy();
}

async function texts(id: string): Promise<string[]> {
	const doc = new Y.Doc();
	Y.applyUpdate(doc, await loadSnapshot(id));
	return doc.getArray<string>('texts').toArray();
}

beforeEach(async () => {
	await resetDBForTests();
	for (const { name } of await indexedDB.databases()) if (name) await deleteDB(name);
});

describe('migrateLegacyDatabases (via getDB)', () => {
	it('copies the board list, images and every board’s content, and keeps the old databases', async () => {
		const asset: AssetRecord = {
			id: 'img',
			boardId: 'a',
			blob: new Blob(['png'], { type: 'image/png' }),
			mime: 'image/png',
			width: 4,
			height: 3,
			createdAt: 5
		};
		await legacyBoardList([meta('a', 'Plan'), { ...meta('b', 'Old'), deletedAt: 9 }], [asset]);
		await legacyBoardContent('a', ['one', 'two']);
		await legacyBoardContent('b', ['trashed']);

		expect(await boardsRepo.get('a')).toEqual(meta('a', 'Plan'));
		expect((await boardsRepo.get('b'))?.deletedAt).toBe(9);
		expect(await boardsRepo.list({ filter: 'starred', sort: 'opened' })).toHaveLength(1);
		const copied = await assetsRepo.get('img');
		expect(copied).toMatchObject({ boardId: 'a', mime: 'image/png', width: 4 });
		expect(await copied!.blob.text()).toBe('png');
		expect(await texts('a')).toEqual(['one', 'two']);
		expect(await texts('b')).toEqual(['trashed']);

		expect(await dbExists(LEGACY_DB_NAME)).toBe(true);
		expect(await dbExists(legacyBoardDbName('a'))).toBe(true);
	});

	it('copies once: later changes to the old databases are not picked up', async () => {
		await legacyBoardList([meta('a', 'Plan')]);
		await getDB();
		await resetDBForTests();
		await legacyBoardList([meta('a', 'Plan'), meta('c', 'Later')]);

		expect(await boardsRepo.get('a')).toBeDefined();
		expect(await boardsRepo.get('c')).toBeUndefined();
	});

	it('does nothing without SMTHNG data, and never creates its databases', async () => {
		await getDB();
		expect(await dbExists(DB_NAME)).toBe(true);
		expect(await dbExists(LEGACY_DB_NAME)).toBe(false);
	});

	it('replaces a board copy left by an interrupted run', async () => {
		await legacyBoardList([meta('a', 'Plan')]);
		await legacyBoardContent('a', ['real']);
		const stray = new Y.Doc();
		const persistence = new IndexeddbPersistence(boardDbName('a'), stray);
		await persistence.whenSynced;
		stray.getArray<string>('texts').push(['partial']);
		await new Promise((r) => setTimeout(r, 50));
		await persistence.destroy();

		// Like the app: boards are only read after the board list (which runs the copy).
		await getDB();
		expect(await texts('a')).toEqual(['real']);
	});

	it('skips boards whose content was never stored', async () => {
		await legacyBoardList([meta('a', 'Plan')]);
		expect(await boardsRepo.get('a')).toBeDefined();
		expect(await dbExists(boardDbName('a'))).toBe(false);
	});
});
