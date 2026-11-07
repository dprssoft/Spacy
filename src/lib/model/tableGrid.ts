// Where the cells of a table sit when some span several rows or columns (merged cells). Pure:
// callers pass each row's cells as their spans.

export interface CellSpan {
	colspan: number;
	rowspan: number;
}

export interface PlacedCell {
	row: number;
	col: number;
	colspan: number;
	rowspan: number;
	/** Index of the cell within its row. */
	index: number;
}

export interface TableGrid {
	rows: number;
	cols: number;
	cells: PlacedCell[];
	/** `at[row][col]`: the cell covering that slot, or null for a hole. */
	at: (PlacedCell | null)[][];
}

/** A span attribute as stored (number or numeric string); anything else is 1. */
export function spanOf(value: unknown): number {
	const n = typeof value === 'string' ? Number(value) : value;
	return typeof n === 'number' && Number.isInteger(n) && n > 1 ? Math.min(n, 1000) : 1;
}

/** Lays cells out left to right, skipping slots taken by row-spanning cells from above. */
export function tableGrid(rows: readonly (readonly CellSpan[])[]): TableGrid {
	const taken: boolean[][] = rows.map(() => []);
	const cells: PlacedCell[] = [];
	rows.forEach((row, r) => {
		let col = 0;
		row.forEach((span, index) => {
			while (taken[r]![col]) col++;
			const rowspan = Math.min(span.rowspan, rows.length - r);
			cells.push({ row: r, col, colspan: span.colspan, rowspan, index });
			for (let dr = 0; dr < rowspan; dr++)
				for (let dc = 0; dc < span.colspan; dc++) taken[r + dr]![col + dc] = true;
			col += span.colspan;
		});
	});
	const cols = Math.max(0, ...taken.map((t) => t.length));
	const at: (PlacedCell | null)[][] = rows.map(() => Array<PlacedCell | null>(cols).fill(null));
	for (const c of cells)
		for (let dr = 0; dr < c.rowspan; dr++)
			for (let dc = 0; dc < c.colspan; dc++) at[c.row + dr]![c.col + dc] = c;
	return { rows: rows.length, cols, cells, at };
}
