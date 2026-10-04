import { describe, expect, it } from 'vitest';
import { distToRect, nearestRect } from './nearest';

const r = (id: string, x: number, y: number, w = 10, h = 10) => ({ id, rect: { x, y, w, h } });

describe('nearestRect', () => {
	it('measures to the edge, 0 inside', () => {
		expect(distToRect({ x: 5, y: 5 }, { x: 0, y: 0, w: 10, h: 10 })).toBe(0);
		expect(distToRect({ x: 13, y: 14 }, { x: 0, y: 0, w: 10, h: 10 })).toBe(5);
	});

	it('picks the closest by edge, then centre, and skips the one already centred', () => {
		const items = [r('far', 1000, 0), r('big', 50, -500, 10, 1000), r('near', 100, 0)];
		expect(nearestRect(items, { x: 0, y: 0 })?.id).toBe('big');
		const tie = [r('a', 20, 0, 10, 100), r('b', 20, -5, 10, 10)];
		expect(nearestRect(tie, { x: 0, y: 0 })?.id).toBe('b');
		expect(nearestRect([r('here', -5, -5), r('next', 40, 0)], { x: 0, y: 0 }, 2)?.id).toBe('next');
		expect(nearestRect([], { x: 0, y: 0 })).toBeNull();
	});
});
