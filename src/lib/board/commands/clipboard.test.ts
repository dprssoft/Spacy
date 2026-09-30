import { beforeEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { getDocsMap } from '$lib/model/doc';
import { createElements } from '$lib/model/ops';
import { samples } from '$lib/model/testFixtures';
import * as assetsRepo from '$lib/storage/assetsRepo';
import { freshDB } from '$lib/storage/testUtils';
import { testCtx } from '../testCtx';
import {
	CLIPBOARD_PREFIX,
	copySelectionText,
	parsePayload,
	pastePlainText,
	pasteText,
	serializeElements
} from './clipboard';

beforeEach(freshDB);

describe('clipboard payloads', () => {
	it('round-trips elements and doc card contents', async () => {
		const src = testCtx('board-a');
		createElements(src.doc, [samples.shape('s'), samples.doccard('d')]);
		getDocsMap(src.doc)
			.get('d')!
			.insert(0, [new Y.XmlText('Card text')]);
		src.selection.set(['s', 'd']);
		const text = copySelectionText(src)!;
		expect(text.startsWith(CLIPBOARD_PREFIX)).toBe(true);
		const payload = parsePayload(text)!;
		expect(payload.elements.map((e) => e.id).sort()).toEqual(['d', 's']);

		const dst = testCtx('board-b');
		await pasteText(dst, text);
		const pasted = [...dst.selection.ids].map((id) => dst.store.get(id)!);
		expect(pasted).toHaveLength(2);
		expect(pasted.some((e) => e.id === 's' || e.id === 'd')).toBe(false);
		const card = pasted.find((e) => e.type === 'doccard')!;
		expect(getDocsMap(dst.doc).get(card.id)?.toString()).toContain('Card text');
	});

	it('rejects malformed or foreign clipboard text', () => {
		expect(parsePayload('hello')).toBeNull();
		expect(parsePayload(CLIPBOARD_PREFIX + '{nope')).toBeNull();
		expect(parsePayload(CLIPBOARD_PREFIX + JSON.stringify({ smthng: 2, elements: [] }))).toBeNull();
		expect(
			parsePayload(
				CLIPBOARD_PREFIX + JSON.stringify({ smthng: 1, sourceBoardId: 'x', elements: [{ id: 1 }] })
			)
		).toBeNull();
	});

	it('remaps groups so pasted copies form their own group', async () => {
		const ctx = testCtx();
		createElements(ctx.doc, [
			{ ...samples.shape('a'), groupId: 'g' },
			{ ...samples.sticky('b'), groupId: 'g' }
		]);
		ctx.selection.set(['a', 'b']);
		const text = copySelectionText(ctx)!;
		await pasteText(ctx, text);
		const groups = new Set([...ctx.selection.ids].map((id) => ctx.store.get(id)!.groupId));
		expect(groups.size).toBe(1);
		expect(groups.has('g')).toBe(false);
	});

	it('cascades repeated pastes onto the same board by 16px', async () => {
		const ctx = testCtx();
		createElements(ctx.doc, [{ ...samples.shape('a'), x: 0, y: 0 }]);
		ctx.selection.set(['a']);
		const text = copySelectionText(ctx)!;
		await pasteText(ctx, text);
		const first = ctx.store.get([...ctx.selection.ids][0]!)!;
		await pasteText(ctx, text);
		const second = ctx.store.get([...ctx.selection.ids][0]!)!;
		expect([first.x, second.x]).toEqual([16, 32]);
	});

	it('centers pastes from elsewhere on the pointer', async () => {
		const src = testCtx('a');
		createElements(src.doc, [{ ...samples.shape('s'), x: 5000, y: 5000, w: 100, h: 50 }]);
		const text = serializeElements(src, [src.store.get('s')!]);
		const dst = testCtx('b');
		dst.pointer = { x: 100, y: 100 };
		await pasteText(dst, text);
		const el = dst.store.get([...dst.selection.ids][0]!)!;
		expect([el.x + el.w / 2, el.y + el.h / 2]).toEqual([100, 100]);
	});

	it('copies image assets when pasting into another board', async () => {
		const assetId = await assetsRepo.put('a', new Blob(['png']), { width: 4, height: 4 });
		const src = testCtx('a');
		createElements(src.doc, [{ ...samples.image('i'), assetId }]);
		const text = serializeElements(src, [src.store.get('i')!]);
		const dst = testCtx('b');
		await pasteText(dst, text);
		const img = dst.store.get([...dst.selection.ids][0]!)!;
		expect(img.type === 'image' && img.assetId).not.toBe(assetId);
		if (img.type === 'image') expect((await assetsRepo.get(img.assetId))?.boardId).toBe('b');
	});

	it('pastes plain text as a text element, one undo step', () => {
		const ctx = testCtx();
		const id = pastePlainText(ctx, 'Line one\nLine two\n')!;
		expect(ctx.store.get(id)).toMatchObject({ type: 'text', text: 'Line one\nLine two' });
		expect(pastePlainText(ctx, '   ')).toBeNull();
		ctx.history.undo();
		expect(ctx.store.get(id)).toBeUndefined();
	});
});
