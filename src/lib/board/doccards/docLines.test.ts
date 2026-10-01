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
});
