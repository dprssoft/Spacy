import { describe, expect, it } from 'vitest';
import { SpatialIndex } from './spatialIndex';

describe('SpatialIndex', () => {
	it('finds items by rect and point, and updates/removes them', () => {
		const idx = new SpatialIndex();
		idx.upsert('a', { x: 0, y: 0, w: 10, h: 10 });
		idx.upsert('b', { x: 100, y: 100, w: 10, h: 10 });
		expect(idx.search({ x: 5, y: 5, w: 1, h: 1 })).toEqual(['a']);
		expect(idx.near({ x: 112, y: 105 }, 3).sort()).toEqual(['b']);

		idx.upsert('a', { x: 200, y: 200, w: 5, h: 5 });
		expect(idx.search({ x: 0, y: 0, w: 20, h: 20 })).toEqual([]);
		expect(idx.get('a')).toEqual({ x: 200, y: 200, w: 5, h: 5 });

		idx.remove('b');
		idx.remove('missing');
		expect(idx.size).toBe(1);
		expect(idx.search({ x: 0, y: 0, w: 1000, h: 1000 })).toEqual(['a']);
	});

	it('bulk loads and reports bounds', () => {
		const idx = new SpatialIndex();
		expect(idx.bounds()).toBeNull();
		idx.load([
			['a', { x: -10, y: 0, w: 10, h: 10 }],
			['b', { x: 50, y: 40, w: 10, h: 20 }]
		]);
		expect(idx.size).toBe(2);
		expect(idx.bounds()).toEqual({ x: -10, y: 0, w: 70, h: 60 });
		idx.clear();
		expect(idx.bounds()).toBeNull();
	});
});
