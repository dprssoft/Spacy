import { describe, expect, it } from 'vitest';
import { compareZ } from '$lib/model/zorder';
import { reorder, type Layered } from './reorder';

// Stacking bottom→top: a, b, c, d. a/b/c overlap; d is far away.
const near = { x: 0, y: 0, w: 100, h: 100 };
const far = { x: 1000, y: 1000, w: 10, h: 10 };
const items: Layered[] = [
	{ id: 'a', z: 'a0', rect: near },
	{ id: 'b', z: 'a1', rect: { ...near, x: 50 } },
	{ id: 'c', z: 'a2', rect: { ...near, y: 50 } },
	{ id: 'd', z: 'a3', rect: far }
];

function orderAfter(changes: Map<string, string>): string[] {
	return items
		.map((it) => ({ id: it.id, z: changes.get(it.id) ?? it.z }))
		.sort((x, y) => compareZ(x.z, y.z))
		.map((it) => it.id);
}

describe('reorder', () => {
	it('brings to front and sends to back, keeping relative order', () => {
		expect(orderAfter(reorder(items, new Set(['a', 'b']), 'front'))).toEqual(['c', 'd', 'a', 'b']);
		expect(orderAfter(reorder(items, new Set(['c', 'd']), 'back'))).toEqual(['c', 'd', 'a', 'b']);
	});

	it('moves forward past the next overlapping element only', () => {
		expect(orderAfter(reorder(items, new Set(['a']), 'forward'))).toEqual(['b', 'a', 'c', 'd']);
		// c overlaps nothing above it (d is far away): unchanged.
		expect(reorder(items, new Set(['c']), 'forward').size).toBe(0);
	});

	it('moves backward past the previous overlapping element', () => {
		expect(orderAfter(reorder(items, new Set(['c']), 'backward'))).toEqual(['a', 'c', 'b', 'd']);
		expect(reorder(items, new Set(['a']), 'backward').size).toBe(0);
	});

	it('keeps the order of several items passing the same neighbour', () => {
		const stack: Layered[] = [
			{ id: 'x', z: 'a0', rect: near },
			{ id: 'y', z: 'a1', rect: near },
			{ id: 'o', z: 'a2', rect: near }
		];
		const changes = reorder(stack, new Set(['x', 'y']), 'forward');
		const result = stack
			.map((it) => ({ id: it.id, z: changes.get(it.id) ?? it.z }))
			.sort((p, q) => compareZ(p.z, q.z))
			.map((it) => it.id);
		expect(result).toEqual(['o', 'x', 'y']);
	});

	it('does nothing when all items are selected or none are', () => {
		expect(reorder(items, new Set(['a', 'b', 'c', 'd']), 'front').size).toBe(0);
		expect(reorder(items, new Set(), 'back').size).toBe(0);
	});
});
