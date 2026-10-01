import * as Y from 'yjs';
import { afterEach, describe, expect, it } from 'vitest';
import { createDocEditor, isSafeLink, type Editor } from './editorFactory';

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
