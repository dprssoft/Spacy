import { describe, expect, it } from 'vitest';
import { compareZ, zAbove, zBelow, zBetween, zManyAbove, zManyBelow } from './zorder';

describe('zorder', () => {
	it('orders keys relative to their anchors', () => {
		const a = zAbove(null);
		const b = zAbove(a);
		const below = zBelow(a);
		const mid = zBetween(a, b);
		expect(compareZ(below, a)).toBe(-1);
		expect(compareZ(a, mid)).toBe(-1);
		expect(compareZ(mid, b)).toBe(-1);
		expect(compareZ(b, b)).toBe(0);
		expect(compareZ(b, a)).toBe(1);
	});

	it('keeps 1,000 sequential keys sorted with plain comparison', () => {
		const keys: string[] = [];
		let z: string | null = null;
		for (let i = 0; i < 1000; i++) keys.push((z = zAbove(z)));
		expect([...keys].sort(compareZ)).toEqual(keys);
		expect(new Set(keys).size).toBe(1000);
	});

	it('keeps repeated insertions between two keys sorted', () => {
		const lo = zAbove(null);
		let hi = zAbove(lo);
		for (let i = 0; i < 200; i++) {
			const next = zBetween(lo, hi);
			expect(lo < next && next < hi).toBe(true);
			hi = next;
		}
	});

	it('generates many keys above and below in order', () => {
		const anchor = zAbove(null);
		const above = zManyAbove(anchor, 5);
		const below = zManyBelow(anchor, 5);
		expect(above).toHaveLength(5);
		expect([...below, anchor, ...above]).toEqual([...below, anchor, ...above].sort(compareZ));
		expect(zManyAbove(anchor, 0)).toEqual([]);
	});
});
