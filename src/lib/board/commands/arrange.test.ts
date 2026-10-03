import { describe, expect, it } from 'vitest';
import { createElements } from '$lib/model/ops';
import { samples } from '$lib/model/testFixtures';
import { STACK_GAP, STACK_PADDING } from '../engine/align';
import { testCtx } from '../testCtx';
import { stackableFrame, stackContents } from './arrange';
import '../elements';

function setup() {
	const ctx = testCtx();
	createElements(ctx.doc, [
		{ ...samples.frame('f'), x: 0, y: 0, w: 300, h: 300 },
		{ ...samples.sticky('b'), x: 150, y: 200, w: 100, h: 100, parentId: 'f' },
		{ ...samples.sticky('a'), x: 40, y: 40, w: 100, h: 100, parentId: 'f' },
		{ ...samples.sticky('locked'), x: 160, y: 20, w: 50, h: 50, parentId: 'f', locked: true }
	]);
	return ctx;
}

describe('stackContents', () => {
	it('stacks unlocked children, grows the frame to fit, as one undo step', () => {
		const ctx = setup();
		ctx.selection.set(['f']);
		expect(stackableFrame(ctx)).toBe('f');
		stackContents(ctx, 'f');
		const a = ctx.store.get('a')!;
		const b = ctx.store.get('b')!;
		expect([a.x, a.y]).toEqual([STACK_PADDING, STACK_PADDING]);
		expect([b.x, b.y]).toEqual([STACK_PADDING, STACK_PADDING + 100 + STACK_GAP]);
		expect(ctx.store.get('locked')!.x).toBe(160);
		expect(ctx.store.get('f')!.h).toBe(Math.max(300, STACK_PADDING * 2 + 200 + STACK_GAP));
		expect([a.parentId, b.parentId]).toEqual(['f', 'f']);

		ctx.undo.undo();
		expect([ctx.store.get('a')!.x, ctx.store.get('b')!.y]).toEqual([40, 200]);
	});

	it('is only offered for a single frame with something to stack', () => {
		const ctx = setup();
		ctx.selection.set(['a']);
		expect(stackableFrame(ctx)).toBeNull();
		ctx.selection.set(['f', 'a']);
		expect(stackableFrame(ctx)).toBeNull();
		createElements(ctx.doc, [{ ...samples.frame('empty'), x: 1000, y: 0 }]);
		ctx.selection.set(['empty']);
		expect(stackableFrame(ctx)).toBeNull();
	});
});
