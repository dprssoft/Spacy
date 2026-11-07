// Row and column edits of a table element's content (`docs[id]`), with plain Yjs: they work
// without the editor (from the "+" buttons of a selected table) and are one LOCAL undo step.
import * as Y from 'yjs';
import { getDocsMap } from './doc';
import { LOCAL, type Origin } from './origins';
import { spanOf, tableGrid } from './tableGrid';

function tableOf(doc: Y.Doc, id: string): Y.XmlElement | null {
	const frag = getDocsMap(doc).get(id);
	const table = frag?.toArray().find((n) => n instanceof Y.XmlElement && n.nodeName === 'table');
	return table instanceof Y.XmlElement ? table : null;
}

const rowsOf = (table: Y.XmlElement): Y.XmlElement[] =>
	table.toArray().filter((n): n is Y.XmlElement => n instanceof Y.XmlElement);

function newCell(type: string, rowspan = 1): Y.XmlElement {
	const cell = new Y.XmlElement(type);
	// Stored as a number, as the editor stores it.
	if (rowspan > 1) (cell as Y.XmlElement<{ rowspan: number }>).setAttribute('rowspan', rowspan);
	cell.insert(0, [new Y.XmlElement('paragraph')]);
	return cell;
}

export type TableEdge = 'start' | 'end';

const typeOf = (n: unknown): string =>
	n instanceof Y.XmlElement && n.nodeName === 'tableHeader' ? 'tableHeader' : 'tableCell';

function gridOf(rows: Y.XmlElement[]) {
	const cells = rows.map((r) =>
		r.toArray().filter((c): c is Y.XmlElement => c instanceof Y.XmlElement)
	);
	const grid = tableGrid(
		cells.map((row) =>
			row.map((c) => ({
				colspan: spanOf(c.getAttribute('colspan')),
				rowspan: spanOf(c.getAttribute('rowspan'))
			}))
		)
	);
	return { grid, cells };
}

/**
 * Adds an empty row at the top (`start`) or bottom (`end`), one cell per column (merged cells
 * beside it don't grow). Its cells copy the type of the cells beside them (a row added above a
 * header row is a header row too).
 */
export function addTableRow(
	doc: Y.Doc,
	id: string,
	at: TableEdge = 'end',
	origin: Origin = LOCAL
): boolean {
	const table = tableOf(doc, id);
	if (!table) return false;
	const rows = rowsOf(table);
	const { grid, cells } = gridOf(rows);
	const edge = at === 'start' ? 0 : grid.rows - 1;
	const beside = (col: number) => {
		const p = grid.at[edge]?.[col];
		return p ? cells[p.row]?.[p.index] : undefined;
	};
	doc.transact(() => {
		const row = new Y.XmlElement('tableRow');
		row.insert(
			0,
			Array.from({ length: Math.max(1, grid.cols) }, (_, col) =>
				newCell(at === 'start' ? typeOf(beside(col)) : 'tableCell')
			)
		);
		table.insert(at === 'start' ? 0 : table.length, [row]);
	}, origin);
	return true;
}

/**
 * Adds an empty column on the left (`start`) or right (`end`). A merged cell on that edge gets
 * one new cell as tall as itself; each new cell copies its neighbour's type.
 */
export function addTableColumn(
	doc: Y.Doc,
	id: string,
	at: TableEdge = 'end',
	origin: Origin = LOCAL
): boolean {
	const table = tableOf(doc, id);
	if (!table) return false;
	const rows = rowsOf(table);
	if (rows.length === 0) return false;
	const { grid, cells } = gridOf(rows);
	const col = at === 'start' ? 0 : grid.cols - 1;
	// Each cell on the edge, once (a cell spanning rows covers several slots).
	const edge = [...new Set(grid.at.map((r) => r[col]).filter((c) => c != null))];
	doc.transact(() => {
		for (const p of edge) {
			const row = rows[p.row]!;
			const cell = newCell(typeOf(cells[p.row]?.[p.index]), p.rowspan);
			row.insert(at === 'start' ? 0 : row.length, [cell]);
		}
		// Rows whose edge slot is a hole (a ragged table) get a cell too.
		grid.at.forEach((r, i) => {
			if (r[col] == null)
				rows[i]!.insert(at === 'start' ? 0 : rows[i]!.length, [newCell('tableCell')]);
		});
	}, origin);
	return true;
}
