import type { DocNode } from '../doccards/markdown';

/** A table element's starting content: `rows` × `cols` empty cells, the first row as headers. */
export function newTableJSON(rows = 3, cols = 3): DocNode {
	const cell = (type: string): DocNode => ({ type, content: [{ type: 'paragraph' }] });
	return {
		type: 'doc',
		content: [
			{
				type: 'table',
				content: Array.from({ length: rows }, (_, r) => ({
					type: 'tableRow',
					content: Array.from({ length: cols }, () => cell(r === 0 ? 'tableHeader' : 'tableCell'))
				}))
			}
		]
	};
}
