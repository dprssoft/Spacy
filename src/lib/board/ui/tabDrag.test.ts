import { describe, expect, it } from 'vitest';
import { dropSlot } from './tabDrag';

const tabs = [
	{ left: 0, right: 100 },
	{ left: 100, right: 160 },
	{ left: 160, right: 300 }
];

describe('tab drag', () => {
	it('finds the gap under the pointer by tab middles', () => {
		expect(dropSlot(tabs, -20)).toBe(0);
		expect(dropSlot(tabs, 49)).toBe(0);
		expect(dropSlot(tabs, 51)).toBe(1);
		expect(dropSlot(tabs, 140)).toBe(2);
		expect(dropSlot(tabs, 250)).toBe(3);
		expect(dropSlot([], 10)).toBe(0);
	});
});
