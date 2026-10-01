import * as Y from 'yjs';
import { describe, expect, it } from 'vitest';
import { createDocEditor } from './editorFactory';
import { fragmentToJSON } from './fragmentJson';
import { docToMarkdown, type DocNode } from './markdown';

const HTML = `
<h1>Plan</h1>
<p>Some <strong>bold</strong>, <em>italic <strong>both</strong></em>, <s>gone</s>, <code>code</code>
and a <a href="https://x.dev/a">link</a>.<br>Second line</p>
<ul><li><p>one</p><ol start="3"><li><p>two</p></li></ol></li></ul>
<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>done</p></li><li data-type="taskItem" data-checked="false"><p>todo</p></li></ul>
<blockquote><p>quote</p></blockquote>
<pre><code class="language-ts">let a = 1;</code></pre>
<hr>
<p></p>`;

describe('fragmentToJSON', () => {
	it('gives the same Markdown as the editor’s own JSON', () => {
		const frag = new Y.Doc().getXmlFragment('f');
		const ed = createDocEditor({
			element: document.createElement('div'),
			fragment: frag,
			editable: true
		});
		ed.commands.setContent(HTML);
		const fromEditor = docToMarkdown(ed.getJSON() as DocNode);
		ed.destroy();
		const fromYjs = docToMarkdown(fragmentToJSON(frag));
		expect(fromYjs).toBe(fromEditor);
		expect(fromYjs).toContain('3. two');
		expect(fromYjs).toContain('- [x] done');
		expect(fromYjs).toContain('[link](https://x.dev/a)');
		expect(fromYjs).toContain('```ts');
	});

	it('reads node attributes and an empty fragment', () => {
		const frag = new Y.Doc().getXmlFragment('f');
		expect(fragmentToJSON(frag)).toEqual({ type: 'doc', content: [] });
		const h = new Y.XmlElement('heading');
		h.setAttribute('level', 2 as unknown as string);
		h.insert(0, [new Y.XmlText('Title')]);
		frag.insert(0, [h]);
		expect(fragmentToJSON(frag).content).toEqual([
			{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Title' }] }
		]);
	});
});
