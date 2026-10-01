import * as Y from 'yjs';
import { describe, expect, it } from 'vitest';
import { getDocsMap, getElementsMap } from '$lib/model/doc';
import { getDefaultStyle } from '../style/styleDefaults';
import { newElementBase } from '$lib/model/defaults';
import { createElements, deleteElements } from '$lib/model/ops';
import { LOCAL } from '$lib/model/origins';
import { createBoardUndo } from '$lib/storage/boardDoc';
import { createDocEditor } from './editorFactory';

function card(doc: Y.Doc, id: string) {
	createElements(doc, [
		{
			...newElementBase('doccard', id, { x: 0, y: 0 }, getDefaultStyle('doccard')),
			type: 'doccard',
			title: 'Untitled',
			collapsed: false,
			expandedH: 280
		}
	]);
}

describe('doc card undo', () => {
	it('undoing a deletion restores the text; editor typing stays out of canvas undo', () => {
		const doc = new Y.Doc();
		const undo = createBoardUndo(doc);
		card(doc, 'c');
		undo.stopCapturing();
		const frag = getDocsMap(doc).get('c')!;
		const ed = createDocEditor({
			element: document.createElement('div'),
			fragment: frag,
			editable: true
		});
		ed.commands.insertContent('<h1>Plan</h1><p>ship it</p>');
		ed.destroy();
		expect(undo.undoStack).toHaveLength(1); // only the creation

		deleteElements(doc, ['c'], LOCAL);
		expect(getDocsMap(doc).has('c')).toBe(false);
		undo.undo();
		expect(getElementsMap(doc).has('c')).toBe(true);
		const restored = getDocsMap(doc).get('c');
		expect(restored?.toString()).toContain('Plan');
		expect(restored?.toString()).toContain('ship it');
	});

	it('undoing a creation removes the docs entry too', () => {
		const doc = new Y.Doc();
		const undo = createBoardUndo(doc);
		card(doc, 'c');
		undo.undo();
		expect(getElementsMap(doc).has('c')).toBe(false);
		expect(getDocsMap(doc).has('c')).toBe(false);
	});
});
