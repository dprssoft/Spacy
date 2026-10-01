import { describe, expect, it } from 'vitest';
import { createElements, updateElement } from '$lib/model/ops';
import { samples } from '$lib/model/testFixtures';
import { deleteWithChildren, syncFrameMembership, withFrameChildren } from './frameMembership';
import { frameHitTest } from './elements/frame/geometry';
import { testCtx } from './testCtx';

function setup() {
	const ctx = testCtx();
	createElements(ctx.doc, [
		{ ...samples.frame('f', 'a0'), x: 0, y: 0, w: 400, h: 300 },
		{ ...samples.sticky('in', 'a1'), x: 50, y: 50, w: 100, h: 100 },
		{ ...samples.shape('out', 'a2'), x: 600, y: 50 }
	]);
	syncFrameMembership(ctx, ['in', 'out']);
	return ctx;
}

describe('frame membership', () => {
	it('adopts elements fully inside a frame', () => {
		const ctx = setup();
		expect(ctx.store.get('in')!.parentId).toBe('f');
		expect(ctx.store.get('out')!.parentId).toBeNull();
		expect(ctx.store.get('f')!.parentId).toBeNull();
	});

	it('releases an element moved out and adopts one moved in', () => {
		const ctx = setup();
		updateElement(ctx.doc, 'in', { x: 700 });
		updateElement(ctx.doc, 'out', { x: 100, y: 100 });
		syncFrameMembership(ctx, ['in', 'out']);
		expect(ctx.store.get('in')!.parentId).toBeNull();
		expect(ctx.store.get('out')!.parentId).toBe('f');
	});

	it('re-checks elements when a frame is resized', () => {
		const ctx = setup();
		const before = new Map([['f', { ...ctx.store.get('f')! }]]);
		updateElement(ctx.doc, 'f', { w: 900 }); // now also covers "out"
		syncFrameMembership(ctx, ['f'], before);
		expect(ctx.store.get('out')!.parentId).toBe('f');
		updateElement(ctx.doc, 'f', { w: 100, h: 100 }); // too small for both
		syncFrameMembership(ctx, ['f'], new Map([['f', { x: 0, y: 0, w: 900, h: 300 }]]));
		expect(ctx.store.get('in')!.parentId).toBeNull();
		expect(ctx.store.get('out')!.parentId).toBeNull();
	});

	it('adds unlocked frame children when moving or copying a frame', () => {
		const ctx = setup();
		createElements(ctx.doc, [{ ...samples.text('locked', 'a3'), x: 60, y: 200, locked: true }]);
		syncFrameMembership(ctx, ['locked']);
		const ids = withFrameChildren(ctx, [ctx.store.get('f')!]).map((e) => e.id);
		expect(ids.sort()).toEqual(['f', 'in']);
	});

	it('deletes a frame with its children; locked children are released, not deleted', () => {
		const ctx = setup();
		createElements(ctx.doc, [{ ...samples.text('locked', 'a3'), x: 60, y: 200, locked: true }]);
		syncFrameMembership(ctx, ['locked']);
		ctx.undo.stopCapturing(); // as deleteSelection does: the delete is its own undo step
		deleteWithChildren(ctx, ['f']);
		expect(ctx.store.get('f')).toBeUndefined();
		expect(ctx.store.get('in')).toBeUndefined();
		expect(ctx.store.get('locked')!.parentId).toBeNull();
		expect(ctx.store.get('out')).toBeDefined();
		ctx.history.undo();
		expect(ctx.store.get('in')!.parentId).toBe('f');
	});
});

describe('frame hit test', () => {
	const f = { ...samples.frame('f'), x: 0, y: 0, w: 400, h: 300, title: 'Plan' };
	it('hits the border band and the title, not the interior', () => {
		expect(frameHitTest(f, { x: 2, y: 150 }, 3)).toBe(true);
		expect(frameHitTest(f, { x: 200, y: 150 }, 3)).toBe(false);
		expect(frameHitTest(f, { x: 10, y: -10 }, 3)).toBe(true);
		expect(frameHitTest(f, { x: 300, y: -10 }, 3)).toBe(false); // beyond the title text
		expect(frameHitTest(f, { x: 420, y: 150 }, 3)).toBe(false);
	});
});
