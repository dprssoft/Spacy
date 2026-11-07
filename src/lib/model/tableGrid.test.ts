import { describe, expect, it } from 'vitest';
import { spanOf, tableGrid } from './tableGrid';

const s = (colspan = 1, rowspan = 1) => ({ colspan, rowspan });

describe('tableGrid', () => {
	it('places cells around a merged cell', () => {
		// | A (2 wide, 2 tall) | B |
		// |                    | C |
		const g = tableGrid([[s(2, 2), s()], [s()]]);
		expect(g.cols).toBe(3);
		expect(g.cells.map((c) => [c.row, c.col])).toEqual([
			[0, 0],
			[0, 2],
			[1, 2]
		]);
		expect(g.at[1]![0]).toBe(g.cells[0]);
		expect(g.at[1]![1]).toBe(g.cells[0]);
	});

	it('clips a rowspan past the last row and leaves holes in ragged tables as null', () => {
		const g = tableGrid([[s(1, 5), s()], []]);
		expect(g.cells[0]!.rowspan).toBe(2);
		expect(g.at[1]![1]).toBeNull();
	});

	it('reads stored spans', () => {
		expect([spanOf(2), spanOf('3'), spanOf(undefined), spanOf(0), spanOf('x')]).toEqual([
			2, 3, 1, 1, 1
		]);
	});
});
