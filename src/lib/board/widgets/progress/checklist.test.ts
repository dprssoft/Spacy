import * as Y from 'yjs';
import { describe, expect, it } from 'vitest';
import { createDocEditor } from '../../doccards/editorFactory';
import { fragmentToJSON } from '../../doccards/fragmentJson';
import type { DocNode } from '../../doccards/markdown';
import { countTasks } from './checklist';

const task = (checked: boolean, ...content: DocNode[]): DocNode => ({
	type: 'taskItem',
	attrs: { checked },
	content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }, ...content]
});
const list = (...items: DocNode[]): DocNode => ({ type: 'taskList', content: items });

describe('countTasks', () => {
	it('counts nested task items', () => {
		const doc: DocNode = {
			type: 'doc',
			content: [
				{ type: 'heading', content: [{ type: 'text', text: 'Plan' }] },
				list(task(true), task(false, list(task(true), task(false)))),
				{ type: 'bulletList', content: [{ type: 'listItem', content: [list(task(true))] }] }
			]
		};
		expect(countTasks(doc)).toEqual({ done: 3, total: 5 });
	});

	it('is null without tasks or without a document', () => {
		expect(countTasks({ type: 'doc', content: [{ type: 'paragraph' }] })).toBeNull();
		expect(countTasks(null)).toBeNull();
	});

	it('reacts to a toggled item in the stored card', () => {
		const frag = new Y.Doc().getXmlFragment('card');
		const ed = createDocEditor({
			element: document.createElement('div'),
			fragment: frag,
			editable: true
		});
		ed.commands.setContent(
			'<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>a</p></li><li data-type="taskItem" data-checked="false"><p>b</p></li></ul>'
		);
		ed.destroy();
		expect(countTasks(fragmentToJSON(frag))).toEqual({ done: 0, total: 2 });
		const item = (frag.get(0) as Y.XmlElement).get(1) as Y.XmlElement;
		frag.doc!.transact(() => item.setAttribute('checked', true as unknown as string));
		expect(countTasks(fragmentToJSON(frag))).toEqual({ done: 1, total: 2 });
	});
});
