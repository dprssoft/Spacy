import { describe, expect, it } from 'vitest';
import { int, mix, pick, rng, shuffle, teams } from './random';

const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

describe('seeded randomness', () => {
	it('gives the same results for the same seed, different ones for another', () => {
		expect(shuffle(items, rng(42))).toEqual(shuffle(items, rng(42)));
		expect(shuffle(items, rng(42))).not.toEqual(shuffle(items, rng(43)));
		expect(pick(items, 3, rng(7))).toEqual(pick(items, 3, rng(7)));
		expect(teams(items, 3, rng(9))).toEqual(teams(items, 3, rng(9)));
	});

	it('stays in range', () => {
		const r = rng(1);
		for (let i = 0; i < 1000; i++) {
			const v = r();
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
			expect(int(r, 6)).toBeLessThan(6);
		}
	});

	it('shuffles and picks without losing or repeating items', () => {
		expect([...shuffle(items, rng(5))].sort()).toEqual(items);
		const picked = pick(items, 3, rng(5));
		expect(new Set(picked).size).toBe(3);
		expect(pick(items, 99, rng(5))).toHaveLength(items.length);
	});

	it('balances teams, every item exactly once', () => {
		for (const n of [2, 3, 4, 7]) {
			const t = teams(items, n, rng(n));
			const sizes = t.map((x) => x.length);
			expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
			expect(t.flat().sort()).toEqual(items);
		}
		expect(teams(['a'], 3, rng(1))).toEqual([['a']]);
		expect(teams([], 2, rng(1))).toEqual([[]]);
	});

	it('mixes a seed and a step into 32 bits', () => {
		expect(mix(1, 2)).toBe(mix(1, 2));
		expect(mix(1, 2)).not.toBe(mix(1, 3));
		expect(mix(123, 4)).toBeGreaterThanOrEqual(0);
		expect(mix(123, 4)).toBeLessThan(2 ** 32);
	});
});
