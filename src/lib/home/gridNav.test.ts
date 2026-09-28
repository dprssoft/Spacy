import { describe, expect, it } from 'vitest';
import { nextIndex } from './gridNav';

describe('nextIndex (4 columns, 10 items)', () => {
	const n = (current: number, key: string) => nextIndex(current, key, 4, 10);

	it('moves horizontally and clamps at the ends', () => {
		expect(n(0, 'ArrowRight')).toBe(1);
		expect(n(9, 'ArrowRight')).toBe(9);
		expect(n(0, 'ArrowLeft')).toBe(0);
		expect(n(4, 'ArrowLeft')).toBe(3);
	});

	it('moves vertically by a row and stays put when there is no row', () => {
		expect(n(1, 'ArrowDown')).toBe(5);
		expect(n(5, 'ArrowDown')).toBe(9);
		expect(n(7, 'ArrowDown')).toBe(7); // no item below in the last partial row
		expect(n(6, 'ArrowUp')).toBe(2);
		expect(n(2, 'ArrowUp')).toBe(2);
	});

	it('jumps to the first and last items', () => {
		expect(n(5, 'Home')).toBe(0);
		expect(n(5, 'End')).toBe(9);
	});

	it('ignores other keys and handles empty grids', () => {
		expect(n(3, 'Enter')).toBe(3);
		expect(nextIndex(0, 'ArrowRight', 4, 0)).toBe(-1);
	});

	it('treats a list as one column', () => {
		expect(nextIndex(2, 'ArrowDown', 1, 5)).toBe(3);
		expect(nextIndex(2, 'ArrowUp', 1, 5)).toBe(1);
	});
});
