import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { getElementsMap } from '$lib/model/doc';
import { createElements, updateElement } from '$lib/model/ops';
import { LOCAL } from '$lib/model/origins';
import { samples } from '$lib/model/testFixtures';
import { BoardStore } from './boardStore.svelte';
import type { BoardContext } from './context';
import { TextEditing } from './editing';
import { SelectionState } from './selection.svelte';

function setup() {
	const doc = new Y.Doc();
	const undo = new Y.UndoManager(getElementsMap(doc), { trackedOrigins: new Set([LOCAL]) });
	const ctx = {
		doc,
		undo,
		store: new BoardStore(doc),
		selection: new SelectionState()
	} as BoardContext;
	return { ctx, doc, undo, editing: new TextEditing(ctx) };
}

const emptyText = () => ({ ...samples.text('t'), text: '' });

describe('TextEditing', () => {
	it('starts editing: selects the element and marks it as edited', () => {
		const { ctx, doc, editing } = setup();
		createElements(doc, [samples.shape('s')]);
		editing.start('s');
		expect(ctx.selection.editingId).toBe('s');
		expect([...ctx.selection.ids]).toEqual(['s']);
		editing.end();
		expect(ctx.selection.editingId).toBeNull();
		expect(ctx.store.get('s')).toBeDefined();
	});

	it('discards a new empty text without leaving an undo or redo step', () => {
		const { ctx, doc, undo, editing } = setup();
		createElements(doc, [samples.shape('earlier')]);
		undo.stopCapturing();
		createElements(doc, [emptyText()]);
		editing.start('t', { discardIfEmpty: true });
		editing.end();
		expect(ctx.store.get('t')).toBeUndefined();
		expect(ctx.selection.size).toBe(0);
		expect(undo.undoStack).toHaveLength(1); // only "earlier"
		expect(undo.redoStack).toHaveLength(0);
	});

	it('keeps a new text once it has content', () => {
		const { ctx, doc, editing } = setup();
		createElements(doc, [emptyText()]);
		editing.start('t', { discardIfEmpty: true });
		updateElement(doc, 't', { text: 'Hello' });
		editing.end();
		expect(ctx.store.get('t')).toBeDefined();
	});

	it('deletes an emptied new text even when other edits happened meanwhile', () => {
		const { ctx, doc, undo, editing } = setup();
		createElements(doc, [emptyText(), samples.shape('s')]);
		editing.start('t', { discardIfEmpty: true });
		updateElement(doc, 't', { text: 'x' });
		undo.stopCapturing();
		updateElement(doc, 't', { text: '' });
		editing.end();
		expect(ctx.store.get('t')).toBeUndefined();
		expect(ctx.store.get('s')).toBeDefined();
	});

	it('never discards existing elements', () => {
		const { ctx, doc, editing } = setup();
		createElements(doc, [emptyText()]);
		editing.start('t');
		editing.end();
		expect(ctx.store.get('t')).toBeDefined();
	});
});
