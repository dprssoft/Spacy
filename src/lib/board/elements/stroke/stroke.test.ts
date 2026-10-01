import { describe, expect, it } from 'vitest';
import { samples } from '$lib/model/testFixtures';
import { strokeAABB, strokeHitTest } from './geometry';
import { shouldSimulatePressure, strokeSvgPath } from './strokePath';

// A horizontal stroke from (0,0) to (100,0), placed at (50, 50).
const line = {
	...samples.stroke('s'),
	x: 50,
	y: 50,
	w: 100,
	h: 1,
	points: [0, 0, 0.5, 50, 0, 0.5, 100, 0, 0.5]
};

describe('stroke geometry', () => {
	it('hits on the line and misses away from it', () => {
		expect(strokeHitTest(line, { x: 100, y: 51 }, 0)).toBe(true);
		expect(strokeHitTest(line, { x: 100, y: 60 }, 0)).toBe(false);
		expect(strokeHitTest(line, { x: 100, y: 60 }, 8)).toBe(true);
	});

	it('accounts for rotation', () => {
		const rotated = { ...line, rotation: Math.PI / 2 };
		// Rotated around its center (100, 50.5): the line is now vertical at x ≈ 100.5.
		expect(strokeHitTest(rotated, { x: 100, y: 20 }, 0)).toBe(true);
		expect(strokeHitTest(rotated, { x: 130, y: 50 }, 0)).toBe(false);
	});

	it('hits a single-point stroke (a dot)', () => {
		const dot = { ...line, w: 1, h: 1, points: [0, 0, 0.5] };
		expect(strokeHitTest(dot, { x: 51, y: 51 }, 0)).toBe(true);
		expect(strokeHitTest(dot, { x: 70, y: 70 }, 0)).toBe(false);
	});

	it('includes the brush thickness in the bounds', () => {
		const box = strokeAABB(line);
		expect(box.y).toBeLessThan(50);
		expect(box.w).toBeGreaterThan(100);
	});
});

describe('stroke path', () => {
	it('simulates pressure only for pressure-less (mouse) input', () => {
		expect(shouldSimulatePressure([0, 0, 0.5, 1, 1, 0.5])).toBe(true);
		expect(shouldSimulatePressure([0, 0, 0.3, 1, 1, 0.7])).toBe(false);
	});

	it('produces a closed path, and a dot for a single point', () => {
		expect(strokeSvgPath(line.points, 2)).toMatch(/^M.*Z$/);
		expect(strokeSvgPath([10, 10, 0.5], 2)).toMatch(/^M.*Z$/); // perfect-freehand draws a dot
		expect(strokeSvgPath([], 2)).toBe('');
	});
});
