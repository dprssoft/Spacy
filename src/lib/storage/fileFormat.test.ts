import { beforeEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { writeDocJSON } from '$lib/board/doccards/fragmentWrite';
import { newTableJSON } from '$lib/board/tables/content';
import { getDocsMap, getElementsMap, listElements } from '$lib/model/doc';
import { createElements } from '$lib/model/ops';
import { addPage, getPages, listAllElements, pageOfElement, setActivePage } from '$lib/model/pages';
import { samples } from '$lib/model/testFixtures';
import type { Element } from '$lib/model/types';
import { bytesToBase64 } from '$lib/shared/base64';
import * as assetsRepo from './assetsRepo';
import { duplicateBoard, loadSnapshot, openBoard } from './boardDoc';
import * as boardsRepo from './boardsRepo';
import {
	exportBackup,
	exportBoardFile,
	importFile,
	InvalidFileError,
	parseSpacyFile
} from './fileFormat';
import { freshDB } from './testUtils';

beforeEach(freshDB);

const asFile = async (blob: Blob, name = 'board.spacy') =>
	new File([await blob.text()], name, { type: 'application/json' });

async function seedBoard(title: string) {
	const meta = await boardsRepo.create({ title });
	const png = new Blob([new Uint8Array(300).fill(7)], { type: 'image/png' });
	const assetId = await assetsRepo.put(meta.id, png, { width: 10, height: 20 });
	const board = await openBoard(meta.id);
	const els: Element[] = [
		samples.shape('s'),
		samples.sticky('st'),
		samples.text('t'),
		{ ...samples.image('i'), assetId },
		samples.stroke('k'),
		samples.frame('f'),
		samples.doccard('d'),
		samples.connector('c'),
		samples.table('tb')
	];
	createElements(board.doc, els);
	const frag = getDocsMap(board.doc).get('d')!;
	board.doc.transact(() => {
		const p = new Y.XmlElement('paragraph');
		p.insert(0, [new Y.XmlText('Doc card text')]);
		frag.insert(0, [p]);
		writeDocJSON(getDocsMap(board.doc).get('tb')!, newTableJSON(2, 2));
	});
	await board.close();
	return { meta, assetId };
}

async function contentOf(id: string) {
	const doc = new Y.Doc();
	Y.applyUpdate(doc, await loadSnapshot(id));
	return doc;
}

describe('board files', () => {
	it('round-trips a board into a new board with remapped assets', async () => {
		const { meta, assetId } = await seedBoard('Roadmap');
		const result = await importFile(await asFile(await exportBoardFile(meta.id)));
		expect(result.warnings).toEqual([]);
		const [copy] = result.boards;
		expect(copy!.id).not.toBe(meta.id);
		expect(copy!.title).toBe('Roadmap');
		expect(copy!.createdAt).toBe(meta.createdAt);

		const doc = await contentOf(copy!.id);
		const els = listElements(doc);
		expect(els).toHaveLength(9);
		const image = els.find((e) => e.type === 'image');
		expect(image?.type === 'image' && image.assetId).not.toBe(assetId);
		const asset = await assetsRepo.get(image?.type === 'image' ? image.assetId : '');
		expect(asset?.boardId).toBe(copy!.id);
		expect(asset?.blob.size).toBe(300);
		expect(getDocsMap(doc).get('d')?.toString()).toContain('Doc card text');
		expect(getDocsMap(doc).get('tb')?.toString()).toContain('<tablecell>');
		// The original is untouched.
		expect(listElements(await contentOf(meta.id))).toHaveLength(9);
		expect((await boardsRepo.list({ filter: 'all', sort: 'created' })).length).toBe(2);
	});

	it('imports every board of a backup', async () => {
		for (const t of ['A', 'B', 'C']) await seedBoard(t);
		const result = await importFile(await asFile(await exportBackup()));
		expect(result.boards.map((b) => b.title).sort()).toEqual(['A', 'B', 'C']);
		expect((await boardsRepo.list({ filter: 'all', sort: 'created' })).length).toBe(6);
	});

	it('drops invalid elements with a warning', async () => {
		const { meta } = await seedBoard('Broken');
		const file = JSON.parse(await (await exportBoardFile(meta.id)).text());
		const doc = new Y.Doc();
		Y.applyUpdate(
			doc,
			Uint8Array.from(atob(file.board.doc), (c) => c.charCodeAt(0))
		);
		getElementsMap(doc).set('bad', new Y.Map([['type', 'shape']]));
		file.board.doc = bytesToBase64(Y.encodeStateAsUpdate(doc));
		const result = await importFile(new File([JSON.stringify(file)], 'x.spacy'));
		expect(result.warnings).toEqual(['“Broken”: 1 damaged object(s) were skipped']);
		expect(listElements(await contentOf(result.boards[0]!.id))).toHaveLength(9);
	});
});

describe('boards with pages', () => {
	it('export, import and duplicate keep every page and remap images on all of them', async () => {
		const meta = await boardsRepo.create({ title: 'Paged' });
		const png = new Blob([new Uint8Array(64).fill(3)], { type: 'image/png' });
		const assetId = await assetsRepo.put(meta.id, png, { width: 4, height: 4 });
		const board = await openBoard(meta.id);
		createElements(board.doc, [samples.shape('first')]);
		const second = addPage(board.doc, { name: 'Second' });
		setActivePage(board.doc, second.id);
		createElements(board.doc, [{ ...samples.image('img'), assetId }, samples.doccard('card')]);
		await board.close();

		const check = async (id: string) => {
			const doc = await contentOf(id);
			expect(getPages(doc).map((p) => p.name)).toEqual(['Page 1', 'Second']);
			const all = listAllElements(doc);
			expect(all.map((e) => e.id).sort()).toEqual(['card', 'first', 'img']);
			const image = all.find((e) => e.type === 'image');
			const newAsset = image?.type === 'image' ? image.assetId : '';
			expect(newAsset).not.toBe(assetId);
			expect((await assetsRepo.get(newAsset))?.boardId).toBe(id);
			expect(pageOfElement(doc, 'img')).toBe(second.id);
		};
		const imported = await importFile(await asFile(await exportBoardFile(meta.id)));
		expect(imported.warnings).toEqual([]);
		await check(imported.boards[0]!.id);
		await check((await duplicateBoard(meta.id)).id);
	});
});

describe('parseSpacyFile', () => {
	const valid = {
		format: 'spacy',
		version: 1,
		kind: 'board',
		exportedAt: 1,
		board: { title: 'x', createdAt: 1, doc: '', assets: [] }
	};
	const reason = (input: unknown) => {
		try {
			parseSpacyFile(typeof input === 'string' ? input : JSON.stringify(input));
			return null;
		} catch (err) {
			expect(err).toBeInstanceOf(InvalidFileError);
			return (err as Error).message;
		}
	};

	it('accepts a valid file', () => {
		expect(reason(valid)).toBeNull();
	});
	it('accepts files exported before the rename (format "smthng")', () => {
		expect(reason({ ...valid, format: 'smthng' })).toBeNull();
	});
	it('rejects non-JSON, a wrong format, a newer version and malformed base64', () => {
		expect(reason('not json')).toMatch(/not JSON/);
		expect(reason({ ...valid, format: 'excalidraw' })).toMatch(/not a Spacy file/);
		expect(reason({ ...valid, version: 2 })).toBe(
			'This file was created with a newer version of Spacy.'
		);
		expect(reason({ ...valid, board: { ...valid.board, doc: '%%%' } })).toMatch(/base64/);
	});
});
