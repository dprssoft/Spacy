import { readFileSync } from 'node:fs';
import * as Y from 'yjs';
import { afterEach, describe, expect, it } from 'vitest';
import { createDocEditor, type Editor } from './editorFactory';
import {
	alignOf,
	blockStyleOf,
	choiceOf,
	clearFormatting,
	setAlign,
	setBlockStyle,
	setChoice
} from './formatCommands';
import { ALIGNS, FORMAT_MARKS, HIGHLIGHTS, TEXT_COLORS, type FormatMark } from './formatOptions';
import { fragmentToJSON } from './fragmentJson';
import { docToMarkdown } from './markdown';

const editors: Editor[] = [];
function editorOn(fragment: Y.XmlFragment = new Y.Doc().getXmlFragment('f')): Editor {
	const e = createDocEditor({ element: document.createElement('div'), fragment, editable: true });
	editors.push(e);
	return e;
}

afterEach(() => {
	for (const e of editors.splice(0)) e.destroy();
});

/** An editor with `html`, everything selected. */
function withContent(html: string, fragment?: Y.XmlFragment): Editor {
	const ed = editorOn(fragment);
	ed.commands.setContent(html);
	ed.commands.selectAll();
	return ed;
}

describe('character formatting', () => {
	it('applies each choice as a data attribute and reads it back', () => {
		const ed = withContent('<p>Hello</p>');
		setChoice(ed, 'textColor', 'red');
		setChoice(ed, 'highlight', 'yellow');
		setChoice(ed, 'fontFamily', 'serif');
		setChoice(ed, 'fontSize', 'large');
		const html = ed.getHTML();
		for (const attr of [
			'data-color="red"',
			'data-highlight="yellow"',
			'data-font="serif"',
			'data-size="large"'
		])
			expect(html).toContain(attr);
		expect(html).not.toContain('style=');
		expect(choiceOf(ed, 'textColor')).toBe('red');
		expect(choiceOf(ed, 'highlight')).toBe('yellow');
		expect(choiceOf(ed, 'fontFamily')).toBe('serif');
		expect(choiceOf(ed, 'fontSize')).toBe('large');
	});

	it('replaces a choice and restores the default with null', () => {
		const ed = withContent('<p>Hello</p>');
		setChoice(ed, 'textColor', 'red');
		setChoice(ed, 'textColor', 'blue');
		expect(ed.getHTML()).toBe('<p><span data-color="blue">Hello</span></p>');
		setChoice(ed, 'textColor', null);
		expect(ed.getHTML()).toBe('<p>Hello</p>');
		expect(choiceOf(ed, 'textColor')).toBeNull();
	});

	it('ignores values that are not on the list, applied or pasted', () => {
		const ed = withContent('<p>Hello</p>');
		setChoice(ed, 'textColor', 'red; background: url(//evil)');
		expect(ed.getHTML()).toBe('<p>Hello</p>');
		ed.commands.setContent(
			'<p><span data-color="url(x)">a</span><span data-font="Comic Sans" data-size="huge">b</span></p>'
		);
		expect(ed.getHTML()).toBe('<p>a<span data-size="huge">b</span></p>');
	});

	it('reads several choices from one span', () => {
		const ed = withContent('<p><span data-color="green" data-highlight="pink">x</span></p>');
		expect(choiceOf(ed, 'textColor')).toBe('green');
		expect(choiceOf(ed, 'highlight')).toBe('pink');
	});

	it('puts the color outside underline, so the line takes the color', () => {
		const ed = withContent('<p>Hello</p>');
		ed.chain().toggleUnderline().run();
		setChoice(ed, 'textColor', 'red');
		expect(ed.getHTML()).toBe('<p><span data-color="red"><u>Hello</u></span></p>');
	});

	it('clears marks and alignment but keeps the block type', () => {
		const ed = withContent('<h2>Title</h2><p>Text</p>');
		ed.chain().toggleBold().toggleUnderline().run();
		setChoice(ed, 'highlight', 'green');
		setAlign(ed, 'center');
		expect(ed.getHTML()).toContain('<h2 data-align="center">');
		clearFormatting(ed);
		expect(ed.getHTML()).toBe('<h2>Title</h2><p>Text</p>');
	});
});

describe('paragraph formatting', () => {
	it('aligns paragraphs and headings; left is not stored', () => {
		const ed = withContent('<h1>Title</h1><p>Text</p>');
		expect(alignOf(ed)).toBe('left');
		setAlign(ed, 'center');
		expect(ed.getHTML()).toBe('<h1 data-align="center">Title</h1><p data-align="center">Text</p>');
		expect(alignOf(ed)).toBe('center');
		setAlign(ed, 'left');
		expect(ed.getHTML()).toBe('<h1>Title</h1><p>Text</p>');
	});

	it('reads alignment from pasted inline styles, and only known values', () => {
		const ed = withContent('<p style="text-align: right">a</p><p data-align="sideways">b</p>');
		expect(ed.getHTML()).toBe('<p data-align="right">a</p><p>b</p>');
	});

	it('switches between the block styles', () => {
		const ed = withContent('<p>Text</p>');
		ed.commands.setTextSelection(2);
		// The editor keeps an empty paragraph after a last block that isn't one.
		const html = () => ed.getHTML().replace(/<p><\/p>$/, '');
		const tags: Record<string, string> = {
			h1: '<h1>Text</h1>',
			quote: '<blockquote><p>Text</p></blockquote>',
			h3: '<h3>Text</h3>',
			code: '<pre><code>Text</code></pre>',
			p: '<p>Text</p>'
		};
		for (const style of ['h1', 'quote', 'h3', 'quote', 'code', 'p'] as const) {
			setBlockStyle(ed, style);
			expect(blockStyleOf(ed)).toBe(style);
			expect(html()).toBe(tags[style]);
		}
	});
	it("keeps each block's alignment when the style of several blocks changes", () => {
		const ed = withContent(
			'<p data-align="center">One</p><p>Two</p><ul><li><p>Item</p></li></ul><p></p>'
		);
		setBlockStyle(ed, 'h2');
		// A list item must start with a paragraph: it stays one. So does the empty last line.
		expect(ed.getHTML()).toBe(
			'<h2 data-align="center">One</h2><h2>Two</h2><ul><li><p>Item</p></li></ul><p></p>'
		);
		setBlockStyle(ed, 'p');
		expect(ed.getHTML()).toBe(
			'<p data-align="center">One</p><p>Two</p><ul><li><p>Item</p></li></ul><p></p>'
		);
	});
});

describe('stored formatting', () => {
	it('survives the Yjs fragment and syncs to another editor', () => {
		const a = new Y.Doc();
		const b = new Y.Doc();
		a.on('update', (u: Uint8Array) => Y.applyUpdate(b, u));
		const edA = withContent('<p>Hello</p>', a.getXmlFragment('f'));
		const edB = editorOn(b.getXmlFragment('f'));
		edA.chain().toggleUnderline().run();
		setChoice(edA, 'textColor', 'violet');
		setAlign(edA, 'right');
		expect(edB.getHTML()).toBe(edA.getHTML());
		expect(edB.getHTML()).toBe(
			'<p data-align="right"><span data-color="violet"><u>Hello</u></span></p>'
		);

		const json = fragmentToJSON(b.getXmlFragment('f'));
		expect(json.content?.[0]?.attrs).toMatchObject({ align: 'right' });
		const marks = json.content?.[0]?.content?.[0]?.marks ?? [];
		expect(marks).toContainEqual({ type: 'textColor', attrs: { color: 'violet' } });
		// Markdown has no colors, underline or alignment: the text is exported plain.
		expect(docToMarkdown(json)).toBe('Hello\n');
	});
});

describe('prose.css', () => {
	const css = readFileSync('src/lib/board/doccards/prose.css', 'utf8');

	it('styles every choice and alignment', () => {
		for (const mark of Object.keys(FORMAT_MARKS) as FormatMark[]) {
			const { data, choices } = FORMAT_MARKS[mark];
			for (const c of choices) expect(css, `${data}=${c.id}`).toContain(`[${data}='${c.id}']`);
		}
		for (const a of ALIGNS.filter((a) => a !== 'left'))
			expect(css).toContain(`[data-align='${a}']`);
	});

	it('defines the color of every swatch', () => {
		for (const c of [...TEXT_COLORS, ...HIGHLIGHTS]) expect(css).toContain(`--doc-${c.id}:`);
	});
});
