import { describe, expect, it } from 'vitest';
import { createElements } from '$lib/model/ops';
import { samples } from '$lib/model/testFixtures';
import { gcAssets } from './images/gcAssets';
import { testCtx } from './testCtx';

const ids = (ctx: ReturnType<typeof testCtx>) => [...ctx.store.elements.keys()].sort();

describe('PagesState', () => {
	it('each page has its own elements; switching swaps what the store shows', () => {
		const ctx = testCtx();
		createElements(ctx.doc, [samples.shape('a')]);
		const first = ctx.pages.current;
		const page = ctx.pages.add();
		expect(ctx.pages.list.map((p) => p.name)).toEqual(['Page 1', 'Page 2']);
		expect(ctx.pages.current).toBe(page.id);
		expect(ids(ctx)).toEqual([]);

		createElements(ctx.doc, [samples.sticky('b'), samples.shape('c')]);
		ctx.selection.set(['b']);
		expect(ids(ctx)).toEqual(['b', 'c']);
		expect(ctx.store.order).toHaveLength(2);

		ctx.pages.select(first);
		expect(ids(ctx)).toEqual(['a']);
		expect(ctx.selection.size).toBe(0); // a selection doesn't carry over
		expect(ctx.store.index.search({ x: -1e6, y: -1e6, w: 2e6, h: 2e6 })).toEqual(['a']);
	});

	it('undo goes back to the page where the change was made', () => {
		const ctx = testCtx();
		const first = ctx.pages.current;
		createElements(ctx.doc, [samples.shape('a')]);
		ctx.undo.stopCapturing();
		const page = ctx.pages.add();
		createElements(ctx.doc, [samples.sticky('b')]);
		ctx.undo.stopCapturing();
		ctx.pages.select(first);

		ctx.undo.undo(); // removes b, on page 2
		expect(ctx.pages.current).toBe(page.id);
		expect(ids(ctx)).toEqual([]);
		ctx.undo.undo(); // removes a, on page 1
		expect(ctx.pages.current).toBe(first);
		expect(ids(ctx)).toEqual([]);
		ctx.undo.redo();
		expect(ids(ctx)).toEqual(['a']);
	});

	it('reveal shows the page an element is on', () => {
		const ctx = testCtx();
		createElements(ctx.doc, [samples.shape('a')]);
		const first = ctx.pages.current;
		ctx.pages.add();
		expect(ctx.store.get('a')).toBeUndefined();
		expect(ctx.pages.reveal('a')).toBe(true);
		expect(ctx.pages.current).toBe(first);
		expect(ctx.store.get('a')?.id).toBe('a');
		expect(ctx.pages.reveal('missing')).toBe(false);
	});

	it('removing the shown page moves to its neighbour and clears undo', () => {
		const ctx = testCtx();
		const first = ctx.pages.current;
		createElements(ctx.doc, [samples.shape('a')]);
		const page = ctx.pages.add();
		createElements(ctx.doc, [samples.sticky('b')]);
		ctx.pages.remove(page.id);
		expect(ctx.pages.list).toHaveLength(1);
		expect(ctx.pages.current).toBe(first);
		expect(ids(ctx)).toEqual(['a']);
		expect(ctx.undo.canUndo()).toBe(false);
		ctx.pages.remove(first); // the last page stays
		expect(ctx.pages.list).toHaveLength(1);
	});

	it('duplicate shows the copy; connectors between copied elements follow the copies', () => {
		const ctx = testCtx();
		const first = ctx.pages.current;
		createElements(ctx.doc, [samples.shape('shape1'), samples.connector('c')]);
		ctx.undo.stopCapturing();
		const copy = ctx.pages.duplicate(first)!;
		expect(ctx.pages.current).toBe(copy.id);
		expect(ctx.pages.list.map((p) => p.name)).toEqual(['Page 1', 'Page 1 copy']);
		const els = [...ctx.store.elements.values()];
		const shape = els.find((e) => e.type === 'shape')!;
		const conn = els.find((e) => e.type === 'connector');
		expect(conn?.type === 'connector' && conn.from).toMatchObject({ elementId: shape.id });
		// Edits on the copy are undoable there.
		ctx.undo.stopCapturing();
		createElements(ctx.doc, [samples.sticky('n')]);
		ctx.undo.undo();
		expect(ctx.store.get('n')).toBeUndefined();
		expect(ctx.store.elements.size).toBe(2);
	});

	it('picks several pages with toggle and range, and removes them together', () => {
		const ctx = testCtx();
		const first = ctx.pages.current;
		const p2 = ctx.pages.add();
		const p3 = ctx.pages.add();
		const p4 = ctx.pages.add();
		createElements(ctx.doc, [samples.shape('on4')]);
		ctx.pages.select(p2.id);
		ctx.pages.togglePick(p4.id);
		expect(ctx.pages.selectedIds).toEqual([p2.id, p4.id]);
		expect(ctx.pages.targets(p4.id)).toEqual([p2.id, p4.id]);
		expect(ctx.pages.targets(first)).toEqual([first]);
		ctx.pages.togglePick(p4.id);
		expect(ctx.pages.selectedIds).toEqual([p2.id]);

		ctx.pages.pickRange(p4.id);
		expect(ctx.pages.selectedIds).toEqual([p2.id, p3.id, p4.id]);
		ctx.pages.remove(ctx.pages.selectedIds);
		expect(ctx.pages.list.map((p) => p.id)).toEqual([first]);
		expect(ctx.pages.current).toBe(first);
		expect(ctx.pages.picked).toEqual([]);
		expect(ctx.undo.canUndo()).toBe(false);

		ctx.pages.remove([first]); // the last page stays
		expect(ctx.pages.list).toHaveLength(1);
	});

	it('a plain click clears the picked pages', () => {
		const ctx = testCtx();
		const first = ctx.pages.current;
		const p2 = ctx.pages.add();
		ctx.pages.togglePick(first);
		expect(ctx.pages.picked).toEqual([first]);
		ctx.pages.select(p2.id);
		expect(ctx.pages.picked).toEqual([]);
	});

	it('rename and move update the list', () => {
		const ctx = testCtx();
		const first = ctx.pages.current;
		const page = ctx.pages.add();
		ctx.pages.rename(page.id, 'Budget');
		ctx.pages.move(page.id, -1);
		expect(ctx.pages.list.map((p) => p.name)).toEqual(['Budget', 'Page 1']);
		expect(ctx.pages.list[1]!.id).toBe(first);
		ctx.pages.moveTo(first, 0);
		expect(ctx.pages.list.map((p) => p.name)).toEqual(['Page 1', 'Budget']);
	});
});

describe('asset cleanup with pages', () => {
	it('keeps images that are used on a page that isn’t shown', async () => {
		const { freshDB } = await import('$lib/storage/testUtils');
		const assetsRepo = await import('$lib/storage/assetsRepo');
		await freshDB();
		const ctx = testCtx('board-pages');
		const png = new Blob([new Uint8Array(10)], { type: 'image/png' });
		const used = await assetsRepo.put('board-pages', png, { width: 1, height: 1 });
		const unused = await assetsRepo.put('board-pages', png, { width: 1, height: 1 });
		const first = ctx.pages.current;
		ctx.pages.add();
		createElements(ctx.doc, [{ ...samples.image('i'), assetId: used }]);
		ctx.pages.select(first); // the image's page is not the active one
		const removed = await gcAssets('board-pages', ctx.doc, Date.now() + 120_000);
		expect(removed).toEqual([unused]);
		expect(await assetsRepo.get(used)).toBeDefined();
	});
});
