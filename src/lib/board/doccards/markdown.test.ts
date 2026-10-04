import { describe, expect, it } from 'vitest';
import { docToMarkdown, type DocNode } from './markdown';

const doc = (...content: DocNode[]): DocNode => ({ type: 'doc', content });
const p = (...content: DocNode[]): DocNode => ({ type: 'paragraph', content });
const t = (
	text: string,
	...marks: (string | { type: string; attrs: Record<string, unknown> })[]
): DocNode => ({
	type: 'text',
	text,
	marks: marks.map((m) => (typeof m === 'string' ? { type: m } : m))
});
const li = (...content: DocNode[]): DocNode => ({ type: 'listItem', content });
const task = (checked: boolean, ...content: DocNode[]): DocNode => ({
	type: 'taskItem',
	attrs: { checked },
	content
});
const md = (...content: DocNode[]) => docToMarkdown(doc(...content));

describe('docToMarkdown', () => {
	it.each<[string, DocNode[], string]>([
		['paragraph', [p(t('Hello'))], 'Hello\n'],
		[
			'headings',
			[1, 2, 3].map((level) => ({ type: 'heading', attrs: { level }, content: [t('H')] })),
			'# H\n\n## H\n\n### H\n'
		],
		[
			'bullet list',
			[{ type: 'bulletList', content: [li(p(t('a'))), li(p(t('b')))] }],
			'- a\n- b\n'
		],
		[
			'ordered list from 3',
			[{ type: 'orderedList', attrs: { start: 3 }, content: [li(p(t('a'))), li(p(t('b')))] }],
			'3. a\n4. b\n'
		],
		[
			'task list',
			[{ type: 'taskList', content: [task(false, p(t('todo'))), task(true, p(t('done')))] }],
			'- [ ] todo\n- [x] done\n'
		],
		['blockquote', [{ type: 'blockquote', content: [p(t('a')), p(t('b'))] }], '> a\n>\n> b\n'],
		[
			'code block',
			[{ type: 'codeBlock', attrs: { language: 'ts' }, content: [t('let a = 1;\nlet b = 2;')] }],
			'```ts\nlet a = 1;\nlet b = 2;\n```\n'
		],
		[
			'code block containing a fence',
			[{ type: 'codeBlock', attrs: { language: null }, content: [t('```\nx\n```')] }],
			'````\n```\nx\n```\n````\n'
		],
		['horizontal rule', [p(t('a')), { type: 'horizontalRule' }, p(t('b'))], 'a\n\n---\n\nb\n'],
		['hard break', [p(t('a'), { type: 'hardBreak' }, t('b'))], 'a  \nb\n'],
		[
			'mention',
			[p(t('see '), { type: 'mention', attrs: { id: 'x', label: 'Login flow' } })],
			'see @Login flow\n'
		],
		['empty paragraphs are dropped', [p(t('a')), p(), p(t('b')), p()], 'a\n\nb\n']
	])('%s', (_, content, expected) => {
		expect(md(...content)).toBe(expected);
	});

	it.each<[string, DocNode, string]>([
		['bold', t('b', 'bold'), '**b**'],
		['italic', t('i', 'italic'), '_i_'],
		['strike', t('s', 'strike'), '~~s~~'],
		['code', t('c*d', 'code'), '`c*d`'],
		['code with backticks', t('a`b', 'code'), '``a`b``'],
		[
			'link',
			t('site', { type: 'link', attrs: { href: 'https://x.dev/a b' } }),
			'[site](https://x.dev/a%20b)'
		],
		['stacked marks in a stable order', t('x', 'italic', 'bold', 'strike'), '**_~~x~~_**'],
		[
			'bold link',
			t('x', 'bold', { type: 'link', attrs: { href: 'https://x.dev' } }),
			'[**x**](https://x.dev)'
		],
		['whitespace stays outside delimiters', t(' x ', 'bold'), ' **x** ']
	])('mark: %s', (_, node, expected) => {
		expect(md(p(t('a '), node))).toBe(`a ${expected}\n`);
	});

	it('merges adjacent text nodes with the same marks', () => {
		expect(md(p(t('ab', 'bold'), t('cd', 'bold'), t('e')))).toBe('**abcd**e\n');
	});

	it('nests bullet → ordered → task lists', () => {
		const nested = {
			type: 'bulletList',
			content: [
				li(p(t('one')), {
					type: 'orderedList',
					attrs: { start: 1 },
					content: [
						li(p(t('two')), {
							type: 'taskList',
							content: [task(true, p(t('three')))]
						})
					]
				}),
				li(p(t('four')))
			]
		};
		expect(md(nested)).toBe('- one\n  1. two\n     - [x] three\n- four\n');
	});

	it('separates several paragraphs inside a list item', () => {
		expect(md({ type: 'bulletList', content: [li(p(t('a')), p(t('b')))] })).toBe('- a\n\n  b\n');
	});

	it('quotes a list inside a blockquote', () => {
		expect(
			md({
				type: 'blockquote',
				content: [p(t('Note')), { type: 'bulletList', content: [li(p(t('x'))), li(p(t('y')))] }]
			})
		).toBe('> Note\n>\n> - x\n> - y\n');
	});

	it('escapes Markdown characters', () => {
		expect(md(p(t('# not a heading')))).toBe('\\# not a heading\n');
		expect(md(p(t('*stars* and _under_ [x]')))).toBe('\\*stars\\* and \\_under\\_ \\[x\\]\n');
		expect(md(p(t('> no quote')))).toBe('\\> no quote\n');
		expect(md(p(t('- no list')))).toBe('\\- no list\n');
		expect(md(p(t('1. no list')))).toBe('1\\. no list\n');
		expect(md(p(t('a-b 2.5 c#')))).toBe('a-b 2.5 c#\n');
	});

	it('writes the title first; an empty doc gives only the title', () => {
		expect(docToMarkdown(doc(p()), { title: 'Plan *v2*' })).toBe('# Plan \\*v2\\*\n');
		expect(docToMarkdown(doc(p(t('x'))), { title: 'T' })).toBe('# T\n\nx\n');
		expect(docToMarkdown(doc())).toBe('');
	});

	it('leaves comments out unless asked, then writes them as footnotes', () => {
		const c = (text: string, ...ids: string[]) => ({
			type: 'text',
			text,
			marks: ids.map((threadId) => ({ type: 'comment', attrs: { threadId } }))
		});
		const d = doc(
			p(t('A '), c('brave', 'x'), c(' new', 'x', 'y'), t(' world '), c('*again*', 'x2')),
			p(c('gone', 'deleted'))
		);
		expect(docToMarkdown(d)).toBe('A brave new world \\*again\\*\n\ngone\n');
		const notes: Record<string, string> = { x: 'Ann: Why?', y: 'Bo: Ok', x2: 'Cy: [sic]' };
		expect(docToMarkdown(d, { comment: (id) => notes[id] ?? null })).toBe(
			'A brave new[^1][^2] world \\*again\\*[^3]\n\ngone\n\n' +
				'[^1]: Ann: Why?\n[^2]: Bo: Ok\n[^3]: Cy: \\[sic\\]\n'
		);
	});
});
