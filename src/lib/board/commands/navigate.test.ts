import { describe, expect, it } from 'vitest';
import { createElements } from '$lib/model/ops';
import { samples } from '$lib/model/testFixtures';
import { testCtx } from '../testCtx';
import { goToNearest } from './navigate';

describe('goToNearest', () => {
	it('picks the nearest object, ignores waystones, and moves on once centred', () => {
		const ctx = testCtx();
		createElements(ctx.doc, [
			{ ...samples.sticky('near'), x: 2000, y: 0 },
			{ ...samples.shape('far'), x: 5000, y: 0 },
			{ ...samples.waystone('pin'), x: 10, y: 10 }
		]);
		// View centred on the world origin (testCtx).
		expect(goToNearest(ctx)).toBe('near');
		expect(ctx.preview.pulse?.id).toBe('near');
		// Arrived (centre on it): the next press goes further.
		const el = ctx.store.get('near')!;
		ctx.viewport.set({ x: 500 - (el.x + el.w / 2), y: 400 - (el.y + el.h / 2), zoom: 1 });
		expect(goToNearest(ctx)).toBe('far');
	});

	it('does nothing on an empty page', () => {
		expect(goToNearest(testCtx())).toBeNull();
	});
});
