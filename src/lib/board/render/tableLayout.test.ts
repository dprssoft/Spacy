import { describe, expect, it } from 'vitest';
import type { DocNode } from '../doccards/markdown';
import { layoutTable, tableModel } from './tableLayout';

const text = (t: string, ...marks: string[]): DocNode => ({
	type: 'text',
	text: t,
	marks: marks.map((type) => ({ type }))
});
const cell = (type: string, ...paras: DocNode[][]): DocNode => ({
	type,
	content: paras.map((content) => ({ type: 'paragraph', content }))
});
const doc = (...rows: DocNode[][]): DocNode => ({
	type: 'doc',
	content: [{ type: 'table', content: rows.map((content) => ({ type: 'tableRow', content })) }]
});
// 10 px per character at size 10.
const measure = (t: string, f: { size: number }) => t.length * f.size;

describe('tableModel', () => {
	it('reads cells, header flags and run formatting', () => {
		const m = tableModel(
			doc([cell('tableHeader', [text('A')])], [cell('tableCell', [text('x', 'bold'), text('y')])])
		);
		expect(m).toHaveLength(2);
		expect(m[0]![0]!.header).toBe(true);
		expect(m[1]![0]!.paras[0]!.runs.map((r) => [r.text, r.bold])).toEqual([
			['x', true],
			['y', false]
		]);
	});

	it('is empty without a table', () => {
		expect(tableModel({ type: 'doc', content: [] })).toEqual([]);
	});
});

describe('layoutTable', () => {
	const opts = { width: 200, fontSize: 10, family: 'sans-serif', measure };

	it('splits the width equally and sizes rows by their tallest cell', () => {
		const t = layoutTable(
			tableModel(
				doc(
					[cell('tableCell', [text('a')]), cell('tableCell', [text('bb')])],
					// 90 px of text space per column: 'one two three four' wraps onto 3 lines.
					[cell('tableCell', [text('one two three four')]), cell('tableCell', [text('x')])]
				)
			),
			opts
		);
		const lh = 15.5;
		const pad = 3;
		expect(t.cols).toBe(2);
		expect(t.cells.map((c) => c.x)).toEqual([0, 100, 0, 100]);
		expect(t.rowYs[1]).toBeCloseTo(lh + pad * 2);
		expect(t.cells[2]!.lines.map((l) => l.runs.map((r) => r.text).join(''))).toEqual([
			'one two',
			'three',
			'four'
		]);
		expect(t.height).toBeCloseTo(lh + pad * 2 + lh * 3 + pad * 2);
	});

	it('keeps formatting across wrapped lines', () => {
		const t = layoutTable(
			tableModel(doc([cell('tableCell', [text('aaaa '), text('bbbb', 'italic')])])),
			{
				...opts,
				width: 60
			}
		);
		const lines = t.cells[0]!.lines.map((l) => l.runs.map((r) => [r.text, r.italic]));
		expect(lines).toEqual([[['aaaa', false]], [['bbbb', true]]]);
	});

	it('lays a merged cell over the columns and rows it spans', () => {
		const wide: DocNode = {
			...cell('tableCell', [text('wide')]),
			attrs: { colspan: 2, rowspan: 2 }
		};
		const t = layoutTable(
			tableModel(doc([wide, cell('tableCell', [text('b')])], [cell('tableCell', [text('c')])])),
			{ ...opts, width: 300 }
		);
		expect(t.cols).toBe(3);
		const [a, b, c] = t.cells;
		expect([a!.x, a!.w, a!.h]).toEqual([0, 200, t.height]);
		expect([b!.x, c!.x, c!.y]).toEqual([200, 200, t.rowYs[1]]);
	});
});
