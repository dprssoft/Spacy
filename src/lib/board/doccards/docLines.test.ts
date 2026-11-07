import { describe, expect, it } from 'vitest';
import { docLines } from './docLines';
import type { DocNode } from './markdown';

const t = (text: string): DocNode => ({ type: 'text', text });
const p = (...content: DocNode[]): DocNode => ({ type: 'paragraph', content });

describe('docLines', () => {
	it('turns blocks into prefixed lines', () => {
		const doc: DocNode = {
			type: 'doc',
			content: [
				{ type: 'heading', attrs: { level: 1 }, content: [t('Plan')] },
				p(t('a'), { type: 'hardBreak' }, t('b'), { type: 'mention', attrs: { label: 'X' } }),
				{
					type: 'bulletList',
					content: [
						{
							type: 'listItem',
							content: [
								p(t('one')),
								{
									type: 'orderedList',
									attrs: { start: 2 },
									content: [{ type: 'listItem', content: [p(t('two'))] }]
								}
							]
						}
					]
				},
				{
					type: 'taskList',
					content: [
						{ type: 'taskItem', attrs: { checked: true }, content: [p(t('done'))] },
						{ type: 'taskItem', attrs: { checked: false }, content: [p(t('todo'))] }
					]
				}
			]
		};
		expect(docLines(doc)).toEqual([
			{ text: 'Plan', kind: 'h' },
			{ text: 'a', kind: 'p' },
			{ text: 'b@X', kind: 'p' },
			{ text: '• one', kind: 'li' },
			{ text: '  2. two', kind: 'li' },
			{ text: '☑ done', kind: 'li' },
			{ text: '☐ todo', kind: 'li' }
		]);
	});

	it('writes one line per table row, header rows as headings', () => {
		const cell = (type: string, text: string): DocNode => ({ type, content: [p(t(text))] });
		const doc: DocNode = {
			type: 'doc',
			content: [
				{
					type: 'table',
					content: [
						{ type: 'tableRow', content: [cell('tableHeader', 'A'), cell('tableHeader', 'B')] },
						{ type: 'tableRow', content: [cell('tableCell', '1'), cell('tableCell', '2')] }
					]
				}
			]
		};
		expect(docLines(doc)).toEqual([
			{ text: 'A  |  B', kind: 'h' },
			{ text: '1  |  2', kind: 'p' }
		]);
	});
});
