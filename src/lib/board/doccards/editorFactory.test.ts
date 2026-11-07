import * as Y from 'yjs';
import { afterEach, describe, expect, it } from 'vitest';
import { createDocEditor, isSafeLink, type Editor } from './editorFactory';
import { CellSelection } from '@tiptap/pm/tables';
import { fragmentToJSON } from './fragmentJson';
import { docToMarkdown } from './markdown';
import { writeDocJSON } from './fragmentWrite';
import { newTableJSON } from '../tables/content';

const editors: Editor[] = [];
function editorOn(fragment: Y.XmlFragment): Editor {
	const e = createDocEditor({ element: document.createElement('div'), fragment, editable: true });
	editors.push(e);
	return e;
}

afterEach(() => {
	for (const e of editors.splice(0)) e.destroy();
});

describe('createDocEditor', () => {
	it('writes rich content into the Y.XmlFragment', () => {
		const doc = new Y.Doc();
		const frag = doc.getXmlFragment('f');
		const ed = editorOn(frag);
		ed.commands.insertContent('<h1>Hi</h1><ul><li><p>a</p></li></ul>');
		const xml = frag.toString();
		expect(xml).toContain('<heading level="1">Hi</heading>');
		expect(xml.toLowerCase()).toContain('<bulletlist>');
		expect(xml).toContain('a');
	});

	it('a second synced doc renders the same text', () => {
		const a = new Y.Doc();
		const b = new Y.Doc();
		a.on('update', (u: Uint8Array) => Y.applyUpdate(b, u));
		const edA = editorOn(a.getXmlFragment('f'));
		const edB = editorOn(b.getXmlFragment('f'));
		edA.commands.insertContent('<h2>Plan</h2><p>first step</p>');
		expect(edB.getText()).toBe(edA.getText());
		expect(edB.getText()).toContain('first step');
	});

	it('supports nested task lists and limits headings to 3 levels', () => {
		const ed = editorOn(new Y.Doc().getXmlFragment('f'));
		ed.commands.insertContent(
			'<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>done</p></li></ul><h5>x</h5>'
		);
		const json = JSON.stringify(ed.getJSON());
		expect(json).toContain('"taskItem"');
		expect(json).toContain('"checked":true');
		expect(json).not.toContain('"level":5');
	});
});

describe('isSafeLink', () => {
	it('allows only http(s) and mailto', () => {
		expect(isSafeLink('https://x.dev')).toBe(true);
		expect(isSafeLink('mailto:a@b.c')).toBe(true);
		expect(isSafeLink('javascript:alert(1)')).toBe(false);
		expect(isSafeLink('data:text/html,hi')).toBe(false);
	});
});

describe('tables', () => {
	it('inserts a table that round-trips through the fragment, formatting kept', () => {
		const frag = new Y.Doc().getXmlFragment('f');
		const ed = editorOn(frag);
		ed.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });
		ed.commands.insertContent('Name');
		ed.commands.goToNextCell();
		ed.commands.toggleBold();
		ed.commands.insertContent('Role');
		const json = fragmentToJSON(frag);
		const table = json.content?.find((n) => n.type === 'table');
		expect(table?.content).toHaveLength(2);
		expect(table?.content?.[0]?.content?.map((c) => c.type)).toEqual([
			'tableHeader',
			'tableHeader'
		]);
		expect(docToMarkdown(json)).toContain('| Name | **Role** |\n| --- | --- |');
	});
});

describe('table element editor', () => {
	function tableEditor() {
		const doc = new Y.Doc();
		const frag = doc.getXmlFragment('t');
		writeDocJSON(frag, newTableJSON(2, 2));
		const ed = createDocEditor({
			element: document.createElement('div'),
			fragment: frag,
			editable: true,
			table: true
		});
		editors.push(ed);
		return { ed, frag };
	}

	it('opens its stored table and formats cell text', () => {
		const { ed, frag } = tableEditor();
		ed.commands.focus('start');
		ed.commands.toggleBold();
		ed.commands.insertContent('Owner');
		ed.commands.goToNextCell();
		ed.commands.toggleUnderline();
		ed.commands.insertContent('Due');
		const json = fragmentToJSON(frag);
		expect(json.content?.map((n) => n.type)).toEqual(['table']);
		expect(docToMarkdown(json)).toContain('| **Owner** | Due |');
		expect(frag.toString()).toContain('underline');
	});

	it('keeps cells to paragraphs: no headings or lists from Markdown shortcuts', () => {
		const { ed } = tableEditor();
		ed.commands.focus('start');
		ed.commands.insertContent('<h1>Big</h1><ul><li><p>item</p></li></ul>');
		const types = new Set<string>();
		ed.state.doc.descendants((n) => void types.add(n.type.name));
		expect(types.has('heading')).toBe(false);
		expect(types.has('bulletList')).toBe(false);
		expect(ed.getText()).toContain('Big');
	});

	it('merges selected cells and splits them again', () => {
		const { ed, frag } = tableEditor();
		// The two header cells: a cell selection from the first to the second.
		const cells: number[] = [];
		ed.state.doc.descendants((n, pos) => {
			if (n.type.name === 'tableHeader') cells.push(pos);
		});
		ed.view.dispatch(
			ed.state.tr.setSelection(CellSelection.create(ed.state.doc, cells[0]!, cells[1]!))
		);
		expect(ed.can().mergeCells()).toBe(true);
		ed.commands.mergeCells();
		const header = () => fragmentToJSON(frag).content![0]!.content![0]!.content!;
		expect(header()).toHaveLength(1);
		expect(header()[0]!.attrs?.colspan).toBe(2);
		expect(ed.can().splitCell()).toBe(true);
		ed.commands.splitCell();
		expect(header()).toHaveLength(2);
	});

	it('always holds one table, even after everything is deleted', () => {
		const { ed } = tableEditor();
		ed.commands.selectAll();
		ed.commands.deleteSelection();
		ed.commands.deleteTable();
		expect(ed.state.doc.childCount).toBe(1);
		expect(ed.state.doc.firstChild?.type.name).toBe('table');
	});
});
