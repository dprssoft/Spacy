import { describe, expect, it } from 'vitest';
import { expandRect, expandRectRatio, rectCenter, rectsIntersect, unionRects } from './geometry';

describe('rect helpers', () => {
	it('expands by a fixed amount or a ratio', () => {
		expect(expandRect({ x: 0, y: 0, w: 10, h: 10 }, 5)).toEqual({ x: -5, y: -5, w: 20, h: 20 });
		expect(expandRectRatio({ x: 0, y: 0, w: 100, h: 50 }, 0.5)).toEqual({
			x: -50,
			y: -25,
			w: 200,
			h: 100
		});
	});

	it('detects intersection, including touching edges', () => {
		const a = { x: 0, y: 0, w: 10, h: 10 };
		expect(rectsIntersect(a, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
		expect(rectsIntersect(a, { x: 10, y: 0, w: 5, h: 5 })).toBe(true);
		expect(rectsIntersect(a, { x: 11, y: 0, w: 5, h: 5 })).toBe(false);
		expect(rectsIntersect(a, { x: 0, y: -6, w: 5, h: 5 })).toBe(false);
	});

	it('unions rects', () => {
		expect(unionRects([])).toBeNull();
		expect(
			unionRects([
				{ x: 0, y: 0, w: 10, h: 10 },
				{ x: -5, y: 20, w: 5, h: 5 }
			])
		).toEqual({ x: -5, y: 0, w: 15, h: 25 });
	});

	it('finds the center', () => {
		expect(rectCenter({ x: 10, y: 20, w: 30, h: 40 })).toEqual({ x: 25, y: 40 });
	});
});
