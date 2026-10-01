import { describe, expect, it } from 'vitest';
import { simplifyRDP } from './simplify';

describe('simplifyRDP', () => {
	it('collapses collinear points to the endpoints', () => {
		const pts = [0, 0, 0.5, 1, 1, 0.6, 2, 2, 0.7, 3, 3, 0.8];
		expect(simplifyRDP(pts, 0.1)).toEqual([0, 0, 0.5, 3, 3, 0.8]);
	});

	it('keeps corners and their pressure', () => {
		const pts = [0, 0, 0.5, 5, 0, 0.5, 10, 0, 0.9, 10, 5, 0.5, 10, 10, 0.5];
		expect(simplifyRDP(pts, 0.5)).toEqual([0, 0, 0.5, 10, 0, 0.9, 10, 10, 0.5]);
	});

	it('drops small wiggles under epsilon but keeps bigger ones', () => {
		const pts = [0, 0, 0.5, 5, 0.2, 0.5, 10, 0, 0.5];
		expect(simplifyRDP(pts, 0.5)).toHaveLength(6);
		expect(simplifyRDP(pts, 0.1)).toHaveLength(9);
	});

	it('handles tiny inputs and closed loops', () => {
		expect(simplifyRDP([], 1)).toEqual([]);
		expect(simplifyRDP([1, 2, 0.5], 1)).toEqual([1, 2, 0.5]);
		const loop = [0, 0, 0.5, 10, 0, 0.5, 10, 10, 0.5, 0, 0, 0.5];
		expect(simplifyRDP(loop, 0.5)).toEqual(loop);
	});
});
