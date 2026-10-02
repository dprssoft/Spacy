import { describe, expect, it } from 'vitest';
import { nextInOrder, readingOrder } from './readingOrder';

const item = (id: string, x: number, y: number, w = 100, h = 60) => ({ id, rect: { x, y, w, h } });

describe('readingOrder', () => {
	it('goes row by row, left to right', () => {
		const items = [item('d', 300, 200), item('b', 300, 0), item('c', 0, 200), item('a', 0, 0)];
		expect(readingOrder(items)).toEqual(['a', 'b', 'c', 'd']);
	});
	it('treats slightly offset tops as the same row', () => {
		expect(readingOrder([item('right', 300, 0), item('left', 0, 12)])).toEqual(['left', 'right']);
	});
	it('starts a new row once an item is below the row', () => {
		expect(
			readingOrder([item('tall', 0, 0, 100, 300), item('low', 200, 320), item('mid', 200, 100)])
		).toEqual(['tall', 'mid', 'low']);
	});
	it('handles an empty list', () => {
		expect(readingOrder([])).toEqual([]);
	});
});

describe('nextInOrder', () => {
	const order = ['a', 'b', 'c'];
	it('starts at the first (or last, going back) when nothing is selected', () => {
		expect(nextInOrder(order, null, false)).toBe('a');
		expect(nextInOrder(order, null, true)).toBe('c');
		expect(nextInOrder(order, 'gone', false)).toBe('a');
	});
	it('steps and leaves at the ends', () => {
		expect(nextInOrder(order, 'a', false)).toBe('b');
		expect(nextInOrder(order, 'c', false)).toBeNull();
		expect(nextInOrder(order, 'a', true)).toBeNull();
		expect(nextInOrder([], null, false)).toBeNull();
	});
});
