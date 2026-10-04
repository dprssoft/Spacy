import { describe, expect, it } from 'vitest';
import { samples } from '$lib/model/testFixtures';
import type { WaystoneElement } from '$lib/model/types';
import { anchorOf, boxAt, flyTarget, orderAfter, orderForMove, routeOf, stepIndex } from './route';

const w = (id: string, order: string, extra: Partial<WaystoneElement> = {}): WaystoneElement => ({
	...samples.waystone(id),
	order,
	...extra
});

describe('route order', () => {
	it('sorts by fractional order with ties by id, ignoring other elements', () => {
		const route = routeOf([w('c', 'a2'), samples.sticky(), w('b', 'a1'), w('a', 'a2')]);
		expect(route.map((x) => x.id)).toEqual(['b', 'a', 'c']);
	});

	it('appends after the last and moves between neighbours', () => {
		const route = routeOf([w('a', 'a0'), w('b', 'a1'), w('c', 'a2')]);
		expect(orderAfter(route) > 'a2').toBe(true);
		expect(orderAfter([])).toBeTruthy();

		const toFront = orderForMove(route, 2, 0)!;
		expect(toFront < 'a0').toBe(true);
		const middle = orderForMove(route, 0, 1)!;
		expect(middle > 'a1' && middle < 'a2').toBe(true);
		expect(orderForMove(route, 1, 1)).toBeNull();
		const re = routeOf([w('a', 'a0'), w('b', 'a1'), { ...w('c', 'a2'), order: toFront }]);
		expect(re.map((x) => x.id)).toEqual(['c', 'a', 'b']);
	});

	it('moves past copies that share a key', () => {
		const route = routeOf([w('a', 'a0'), w('b', 'a1'), w('c', 'a1')]);
		const key = orderForMove(route, 0, 1)!;
		expect(key > 'a1').toBe(true);
	});
});

describe('stepIndex', () => {
	it('steps, starts at an end, and wraps only when asked', () => {
		expect(stepIndex(-1, 3, 1, true)).toBe(0);
		expect(stepIndex(-1, 3, -1, true)).toBe(2);
		expect(stepIndex(0, 3, 1, false)).toBe(1);
		expect(stepIndex(2, 3, 1, true)).toBe(0);
		expect(stepIndex(2, 3, 1, false)).toBeNull();
		expect(stepIndex(0, 3, -1, true)).toBe(2);
		expect(stepIndex(0, 3, -1, false)).toBeNull();
		expect(stepIndex(0, 0, 1, true)).toBeNull();
		expect(stepIndex(5, 3, 1, true)).toBe(0);
	});
});

describe('flyTarget', () => {
	it('centres the pin tip at its zoom, clamped', () => {
		const pin = w('a', 'a0', { ...boxAt({ x: 100, y: 50 }), zoom: 2 });
		expect(anchorOf(pin)).toEqual({ x: 100, y: 50 });
		expect(flyTarget(pin, { w: 800, h: 600 })).toEqual({ x: 400 - 200, y: 300 - 100, zoom: 2 });
		expect(flyTarget({ ...pin, zoom: 99 }, { w: 800, h: 600 }).zoom).toBe(4);
		expect(flyTarget({ ...pin, zoom: 0.001 }, { w: 800, h: 600 }).zoom).toBe(0.1);
	});
});
