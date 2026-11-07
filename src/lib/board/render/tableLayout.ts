// A table's cells as rows of formatted runs, and their layout for static rendering (exports,
// thumbnails). Pure: works on the editor's JSON.
import type { DocNode } from '../doccards/markdown';
import { spanOf, tableGrid } from '$lib/model/tableGrid';
import { wrapText, type FontSpec } from './wrapText';

export interface TableRun {
	text: string;
	bold: boolean;
	italic: boolean;
	underline: boolean;
	strike: boolean;
	/** A `#rrggbb` text color; named colors and the default are null. */
	color: string | null;
}

export interface TablePara {
	align: 'left' | 'center' | 'right';
	runs: TableRun[];
}

export interface TableCellModel {
	header: boolean;
	colspan: number;
	rowspan: number;
	paras: TablePara[];
}

export type TableModel = TableCellModel[][];

/** The rows of the first table in a document (a table element holds exactly one). */
export function tableModel(doc: DocNode): TableModel {
	const table = findTable(doc);
	if (!table) return [];
	return (table.content ?? []).map((row) =>
		(row.content ?? []).map((cell) => ({
			header: cell.type === 'tableHeader',
			colspan: spanOf(cell.attrs?.colspan),
			rowspan: spanOf(cell.attrs?.rowspan),
			paras: paragraphs(cell)
		}))
	);
}

function findTable(node: DocNode): DocNode | null {
	if (node.type === 'table') return node;
	for (const c of node.content ?? []) {
		const t = findTable(c);
		if (t) return t;
	}
	return null;
}

function paragraphs(node: DocNode): TablePara[] {
	const out: TablePara[] = [];
	for (const block of node.content ?? []) {
		if (block.type === 'paragraph' || block.type === 'heading') {
			const a = block.attrs?.align;
			out.push({
				align: a === 'center' || a === 'right' ? a : 'left',
				runs: (block.content ?? []).flatMap(run)
			});
		} else out.push(...paragraphs(block));
	}
	return out;
}

function run(node: DocNode): TableRun[] {
	const text =
		node.type === 'text'
			? (node.text ?? '')
			: node.type === 'hardBreak'
				? '\n'
				: node.type === 'mention'
					? `@${String(node.attrs?.label ?? '')}`
					: '';
	if (!text) return [];
	const has = (t: string) => (node.marks ?? []).some((m) => m.type === t);
	const color = (node.marks ?? []).find((m) => m.type === 'textColor')?.attrs?.color;
	return [
		{
			text,
			bold: has('bold'),
			italic: has('italic'),
			underline: has('underline'),
			strike: has('strike'),
			color: typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color) ? color : null
		}
	];
}

// --- Layout --------------------------------------------------------------------------------------

export interface LaidLine {
	/** Baseline-independent top of the line, relative to the table. */
	y: number;
	x: number;
	align: TablePara['align'];
	/** The line's text split into runs (formatting kept). */
	runs: TableRun[];
}

export interface LaidCell {
	x: number;
	y: number;
	w: number;
	h: number;
	header: boolean;
	lines: LaidLine[];
}

export interface TableLayout {
	cols: number;
	/** Row boundaries, top to bottom (rows + 1 values). */
	rowYs: number[];
	cells: LaidCell[];
	height: number;
	lineHeight: number;
}

export interface TableLayoutOptions {
	width: number;
	fontSize: number;
	family: string;
	measure: (text: string, font: FontSpec) => number;
}

/**
 * Equal columns; each row as tall as its tallest cell, and a merged cell's last row grown until the
 * cell fits. Mirrors `prose.css` (padding .3em .5em).
 */
export function layoutTable(model: TableModel, o: TableLayoutOptions): TableLayout {
	const grid = tableGrid(model);
	const cols = Math.max(1, grid.cols);
	const colW = o.width / cols;
	const padX = o.fontSize * 0.5;
	const padY = o.fontSize * 0.3;
	const lineHeight = o.fontSize * 1.55;
	const gap = o.fontSize * 0.3;

	// Lines of each cell, relative to its top.
	const placed = grid.cells.map((p) => {
		const cell = model[p.row]![p.index]!;
		const x = p.col * colW;
		const w = p.colspan * colW;
		const lines: LaidLine[] = [];
		let ly = padY;
		cell.paras.forEach((para, i) => {
			if (i > 0) ly += gap;
			const font: FontSpec = { size: o.fontSize, bold: cell.header, family: o.family };
			const text = para.runs.map((r) => r.text).join('');
			const wrapped = wrapText(text, w - padX * 2, (t) => o.measure(t, font));
			let from = 0;
			for (const l of wrapped) {
				const start = text.indexOf(l, from);
				const at = start < 0 ? from : start;
				lines.push({ y: ly, x: x + padX, align: para.align, runs: slice(para.runs, at, l.length) });
				from = at + l.length;
				ly += lineHeight;
			}
		});
		if (cell.paras.length === 0) ly += lineHeight;
		return { p, cell, x, w, lines, need: ly + padY };
	});

	const heights = Array.from({ length: grid.rows }, () => lineHeight + padY * 2);
	for (const c of placed)
		if (c.p.rowspan === 1) heights[c.p.row] = Math.max(heights[c.p.row]!, c.need);
	for (const c of placed) {
		if (c.p.rowspan === 1) continue;
		const last = c.p.row + c.p.rowspan - 1;
		let sum = 0;
		for (let r = c.p.row; r <= last; r++) sum += heights[r]!;
		if (sum < c.need) heights[last]! += c.need - sum;
	}
	const rowYs = [0];
	for (const h of heights) rowYs.push(rowYs.at(-1)! + h);

	const cells: LaidCell[] = placed.map((c) => {
		const y = rowYs[c.p.row]!;
		return {
			x: c.x,
			y,
			w: c.w,
			h: rowYs[c.p.row + c.p.rowspan]! - y,
			header: c.cell.header,
			lines: c.lines.map((l) => ({ ...l, y: l.y + y }))
		};
	});
	return { cols, rowYs, cells, height: rowYs.at(-1)!, lineHeight };
}

/** The runs covering `[at, at + len)` of their joined text. */
function slice(runs: TableRun[], at: number, len: number): TableRun[] {
	const out: TableRun[] = [];
	let pos = 0;
	for (const r of runs) {
		const s = Math.max(at, pos);
		const e = Math.min(at + len, pos + r.text.length);
		if (e > s) out.push({ ...r, text: r.text.slice(s - pos, e - pos).replace(/\n/g, '') });
		pos += r.text.length;
	}
	return out.filter((r) => r.text);
}
