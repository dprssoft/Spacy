import { describe, expect, it } from 'vitest';
import { samples } from '$lib/model/testFixtures';
import type { DocNode } from '../doccards/markdown';
import { docxToHtml, unzip } from '../files/docx';
import { compile, DEFAULT_COMPILE, manuscriptToMarkdown, type CompileOptions } from './compile';
import { manuscriptToDocx } from './docxWriter';
import { manuscriptToHtml } from './manuscriptHtml';
import type { Chapter } from './outline';
import { crc32 } from './zip';

const p = (text: string, marks?: DocNode['marks']): DocNode => ({
	type: 'paragraph',
	content: [{ type: 'text', text, marks }]
});
const frame = (id: string, title: string) => ({ ...samples.frame(id), title });
const card = (id: string, title: string, collapsed = false) => ({
	...samples.doccard(id),
	title,
	collapsed
});

const chapters: Chapter[] = [
	{ frame: frame('f1', 'The beginning'), cards: [card('a', 'Scene A'), card('b', 'Scene B')] },
	{ frame: frame('f2', ''), cards: [card('c', 'Scene C', true)] },
	{ frame: null, cards: [card('d', 'Loose'), card('e', 'Empty')] }
];
const contents: Record<string, DocNode> = {
	a: {
		type: 'doc',
		content: [
			{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Inside' }] },
			p('Alpha text.')
		]
	},
	b: { type: 'doc', content: [p('Bravo ', [{ type: 'bold' }]), p('second para')] },
	c: { type: 'doc', content: [p('Charlie.')] },
	d: { type: 'doc', content: [p('Delta.')] },
	e: { type: 'doc', content: [{ type: 'paragraph' }] }
};
const run = (o: Partial<CompileOptions> = {}) =>
	compile(chapters, (id) => contents[id]!, { ...DEFAULT_COMPILE, ...o });

describe('compile', () => {
	it('chapters from frames (untitled ones numbered), cards outside frames last, empty cards skipped', () => {
		const m = run();
		expect(m.chapters.map((c) => c.heading)).toEqual(['The beginning', 'Chapter 2', null]);
		expect(m.chapters[2]!.scenes).toHaveLength(1);
		expect(m.chapters[0]!.scenes[0]!.title).toBe('');
	});

	it('frames already named "Chapter N" are not numbered twice', () => {
		const named: Chapter[] = [{ frame: frame('f', 'Chapter 7'), cards: [card('d', 'x')] }];
		const m = compile(named, (id) => contents[id]!, { ...DEFAULT_COMPILE, numberChapters: true });
		expect(m.chapters[0]!.heading).toBe('Chapter 7');
	});

	it('numbering, scene titles, chapter selection, collapsed cards, demoted headings', () => {
		const m = run({
			numberChapters: true,
			sceneTitles: true,
			include: new Set(['f1', 'f2']),
			skipCollapsed: true
		});
		expect(m.chapters.map((c) => c.heading)).toEqual(['Chapter 1: The beginning']);
		expect(m.chapters[0]!.scenes.map((s) => s.title)).toEqual(['Scene A', 'Scene B']);
		expect(m.chapters[0]!.scenes[0]!.blocks[0]!.attrs?.level).toBe(3);
	});

	it('Markdown: title page, chapters, separators', () => {
		const md = manuscriptToMarkdown(
			run({ titlePage: { title: 'My Book', author: 'A. Writer', date: 'Today' } })
		);
		expect(md).toContain('# My Book\n\n*A. Writer*  \nToday');
		expect(md).toContain(
			'# The beginning\n\n### Inside\n\nAlpha text.\n\n\\* \\* \\*\n\n**Bravo** \n\nsecond para'
		);
		expect(md.indexOf('# Chapter 2')).toBeLessThan(md.indexOf('Delta.'));
	});

	it('HTML print view: chapters as page-broken sections', () => {
		const html = manuscriptToHtml(run({ titlePage: { title: 'T', author: '', date: '' } }), 'T');
		expect(html).toContain('<section class="title-page"><h1>T</h1>');
		expect(html.match(/<section class="chapter">/g)).toHaveLength(3);
		expect(html).toContain('<strong>Bravo </strong>');
	});
});

describe('docx writer', () => {
	it('CRC32 matches the standard check value', () => {
		expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
	});

	it('round-trips through our own reader: headings, paragraphs, marks, lists, links', async () => {
		const m = run({ sceneTitles: true, titlePage: { title: 'My Book', author: 'Me', date: '' } });
		m.chapters[2]!.scenes[0]!.blocks.push(
			{
				type: 'bulletList',
				content: [
					{ type: 'listItem', content: [p('one')] },
					{ type: 'listItem', content: [p('two')] }
				]
			},
			{ type: 'orderedList', content: [{ type: 'listItem', content: [p('first')] }] },
			p('a link', [{ type: 'link', attrs: { href: 'https://example.com' } }])
		);
		const bytes = manuscriptToDocx(m);
		const files = await unzip(
			bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
		);
		expect([...files.keys()].sort()).toEqual([
			'[Content_Types].xml',
			'_rels/.rels',
			'word/_rels/document.xml.rels',
			'word/document.xml',
			'word/numbering.xml',
			'word/styles.xml'
		]);
		for (const f of files.values()) {
			const xml = new TextDecoder().decode(f);
			expect(
				new DOMParser().parseFromString(xml, 'application/xml').getElementsByTagName('parsererror')
			).toHaveLength(0);
		}
		const html = await docxToHtml(
			bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
		);
		expect(html).toContain('<h1>The beginning</h1>');
		expect(html).toContain('<h2>Scene A</h2>');
		expect(html).toContain('<h3>Inside</h3>');
		expect(html).toContain('<strong>Bravo </strong>');
		expect(html).toContain('<ul><li><p>one</p></li><li><p>two</p></li></ul>');
		expect(html).toContain('<ol><li><p>first</p></li></ol>');
		expect(html).toContain('<a href="https://example.com">a link</a>');
		expect(html.indexOf('My Book')).toBeLessThan(html.indexOf('The beginning'));
	});
});
