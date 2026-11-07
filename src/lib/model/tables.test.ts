import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { writeDocJSON } from '$lib/board/doccards/fragmentWrite';
import { fragmentToJSON } from '$lib/board/doccards/fragmentJson';
import { newTableJSON } from '$lib/board/tables/content';
import { getDocsMap } from './doc';
import { LOCAL } from './origins';
import type { DocNode } from '$lib/board/doccards/markdown';
import { addTableColumn, addTableRow } from './tables';

function setup() {
	const doc = new Y.Doc();
	const frag = new Y.XmlFragment();
	getDocsMap(doc).set('t', frag);
	writeDocJSON(frag, newTableJSON(2, 3));
	const shape = () =>
		(fragmentToJSON(frag).content?.[0]?.content ?? []).map((r) =>
			(r.content ?? []).map((c) => c.type)
		);
	return { doc, shape };
}

describe('table rows and columns', () => {
	it('adds a body row as wide as the table', () => {
		const { doc, shape } = setup();
		expect(addTableRow(doc, 't')).toBe(true);
		expect(shape()).toHaveLength(3);
		expect(shape()[2]).toEqual(['tableCell', 'tableCell', 'tableCell']);
	});

	it('adds a column; the header row gets a header cell', () => {
		const { doc, shape } = setup();
		addTableColumn(doc, 't');
		expect(shape()).toEqual([
			['tableHeader', 'tableHeader', 'tableHeader', 'tableHeader'],
			['tableCell', 'tableCell', 'tableCell', 'tableCell']
		]);
	});

	it('adds at the start: a row above the header is a header row, a column on the left', () => {
		const { doc, shape } = setup();
		addTableRow(doc, 't', 'start');
		addTableColumn(doc, 't', 'start');
		expect(shape()).toEqual([
			['tableHeader', 'tableHeader', 'tableHeader', 'tableHeader'],
			['tableHeader', 'tableHeader', 'tableHeader', 'tableHeader'],
			['tableCell', 'tableCell', 'tableCell', 'tableCell']
		]);
	});

	it('adds next to merged cells: one cell per merged edge cell, as tall as it', () => {
		const doc = new Y.Doc();
		const frag = new Y.XmlFragment();
		getDocsMap(doc).set('t', frag);
		const cell = (attrs?: Record<string, unknown>): DocNode => ({
			type: 'tableCell',
			...(attrs ? { attrs } : {}),
			content: [{ type: 'paragraph' }]
		});
		// | a | b (2 tall) |
		// | c |            |
		writeDocJSON(frag, {
			type: 'doc',
			content: [
				{
					type: 'table',
					content: [
						{ type: 'tableRow', content: [cell(), cell({ rowspan: 2 })] },
						{ type: 'tableRow', content: [cell()] }
					]
				}
			]
		});
		addTableColumn(doc, 't');
		addTableRow(doc, 't');
		const rows = fragmentToJSON(frag).content![0]!.content!;
		expect(rows.map((r) => r.content!.length)).toEqual([3, 1, 3]);
		expect(rows[0]!.content![2]!.attrs?.rowspan).toBe(2);
	});

	it('is one undo step and skips missing tables', () => {
		const { doc, shape } = setup();
		const undo = new Y.UndoManager(getDocsMap(doc), { trackedOrigins: new Set([LOCAL]) });
		addTableColumn(doc, 't');
		undo.undo();
		expect(shape()[0]).toHaveLength(3);
		expect(addTableRow(doc, 'nope')).toBe(false);
	});
});
