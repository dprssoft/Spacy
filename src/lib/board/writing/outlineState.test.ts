import { describe, expect, it } from 'vitest';
import { getActivePageId } from '$lib/model/doc';
import { createElements } from '$lib/model/ops';
import { getOutline } from '$lib/model/outline';
import { samples } from '$lib/model/testFixtures';
import '../elements';
import { testCtx } from '../testCtx';
import { outlineIds } from './outline';

function setup() {
	const ctx = testCtx();
	createElements(ctx.doc, [
		{ ...samples.frame('c1'), x: 0, y: 0, w: 400, h: 400 },
		{ ...samples.frame('c2'), x: 600, y: 0, w: 400, h: 300 },
		{ ...samples.doccard('a'), x: 20, y: 20, w: 200, h: 150, parentId: 'c1' },
		{ ...samples.doccard('b'), x: 20, y: 200, w: 200, h: 150, parentId: 'c1' },
		{ ...samples.doccard('c'), x: 620, y: 20, w: 200, h: 150, parentId: 'c2' }
	]);
	return ctx;
}

describe('OutlineState', () => {
	it('reorders within a chapter and stores the order on the page', () => {
		const ctx = setup();
		expect(outlineIds(ctx.outline.chapters)).toEqual(['a', 'b', 'c']);
		ctx.outline.move('b', 'c1', 0);
		expect(outlineIds(ctx.outline.chapters)).toEqual(['b', 'a', 'c']);
		expect(getOutline(ctx.doc, getActivePageId(ctx.doc))).toEqual(['b', 'a', 'c']);
	});

	it('moving into another chapter moves the card into that frame (growing it), as one undo step', () => {
		const ctx = setup();
		ctx.outline.move('a', 'c2', 1);
		const a = ctx.store.get('a')!;
		const c2 = ctx.store.get('c2')!;
		expect(a.parentId).toBe('c2');
		expect(a.x).toBeGreaterThanOrEqual(c2.x);
		expect(a.y + a.h).toBeLessThanOrEqual(c2.y + c2.h);
		expect(outlineIds(ctx.outline.chapters)).toEqual(['b', 'c', 'a']);

		ctx.undo.undo();
		expect(ctx.store.get('a')).toMatchObject({ x: 20, y: 20, parentId: 'c1' });
		expect(ctx.store.get('c2')!.h).toBe(300);
		expect(outlineIds(ctx.outline.chapters)).toEqual(['a', 'b', 'c']);
	});
});
