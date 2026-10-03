import { describe, expect, it } from 'vitest';
import { docFileKind } from './fileKinds';
import { htmlToDoc, markdownToHtml, textToHtml } from './importDocs';

describe('docFileKind', () => {
	it('detects by extension, then by type', () => {
		expect(docFileKind({ name: 'notes.MD', type: '' })).toBe('markdown');
		expect(docFileKind({ name: 'README', type: 'text/markdown' })).toBe('markdown');
		expect(docFileKind({ name: 'a.txt', type: '' })).toBe('text');
		expect(docFileKind({ name: 'paste', type: 'text/plain' })).toBe('text');
		expect(docFileKind({ name: 'Report.docx', type: '' })).toBe('docx');
		expect(docFileKind({ name: 'photo.png', type: 'image/png' })).toBeNull();
		expect(docFileKind({ name: 'old.doc', type: 'application/msword' })).toBeNull();
	});
});

describe('textToHtml', () => {
	it('splits paragraphs on blank lines and keeps single line breaks', () => {
		expect(textToHtml('one\r\ntwo\n\n\nthree <b>\n')).toBe(
			'<p>one<br>two</p><p>three &lt;b&gt;<br></p>'
		);
	});
});

describe('htmlToDoc', () => {
	it('maps Markdown onto the doc card schema', () => {
		const doc = htmlToDoc(
			markdownToHtml(
				'# Title\n\nSome **bold** and *it* [link](https://x.y).\n\n- a\n- b\n\n1. one\n\n> quote\n\n```\ncode\n```'
			)
		);
		expect(doc.type).toBe('doc');
		const types = doc.content?.map((n) => n.type);
		expect(types).toEqual([
			'heading',
			'paragraph',
			'bulletList',
			'orderedList',
			'blockquote',
			'codeBlock'
		]);
		const marks = doc.content?.[1]?.content?.flatMap((n) => n.marks?.map((m) => m.type) ?? []);
		expect(marks).toEqual(expect.arrayContaining(['bold', 'italic', 'link']));
	});

	it('turns GitHub task lists into checklists', () => {
		const doc = htmlToDoc(markdownToHtml('- [x] done\n- [ ] todo'));
		const list = doc.content?.[0];
		expect(list?.type).toBe('taskList');
		expect(list?.content?.map((i) => i.attrs?.checked)).toEqual([true, false]);
	});

	it('unlinks javascript: links and drops unknown elements', () => {
		const doc = htmlToDoc('<p><a href="javascript:alert(1)">x</a><script>bad()</script></p>');
		expect(JSON.stringify(doc)).not.toMatch(/javascript|bad\(\)/);
		expect(doc.content?.[0]?.content?.[0]?.text).toBe('x');
	});
});
