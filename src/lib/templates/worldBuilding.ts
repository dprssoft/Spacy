import type * as Y from 'yjs';
import { TemplateBuilder } from './builder';
import { commitWithDocs, doc, h, items, p } from './docHelpers';
import type { DocNode } from '$lib/board/doccards/markdown';

const AREAS: [string, 'green' | 'orange' | 'violet' | 'teal', DocNode[]][] = [
	[
		'Places',
		'green',
		[
			h(2, 'Places'),
			p('Where does the story happen? One heading per place.'),
			items('bulletList', ['Geography', 'Climate', 'What it feels like to stand there'])
		]
	],
	[
		'Cultures',
		'orange',
		[
			h(2, 'Cultures'),
			items('bulletList', ['Customs and taboos', 'Language and names', 'Food, clothing, festivals'])
		]
	],
	[
		'Rules and magic',
		'violet',
		[
			h(2, 'Rules'),
			p('What is possible in this world, and what does it cost?'),
			items('bulletList', ['Limits', 'Costs', 'Who knows about it'])
		]
	],
	[
		'History',
		'teal',
		[
			h(2, 'Timeline'),
			items('orderedList', ['The founding', 'The great change', 'The present day'])
		]
	]
];

export function buildWorldBuilding(ydoc: Y.Doc): void {
	const b = new TemplateBuilder();
	const frames = b.frameGrid(
		AREAS.map(([t]) => t),
		{ x: 0, y: 0 },
		{ w: 460, h: 520 },
		{ cols: 2, tints: AREAS.map(([, tint]) => tint) }
	);
	const contents = new Map<string, DocNode>();
	frames.forEach((f, i) => {
		const card = b.docCard({ x: f.x + 30, y: f.y + 30, w: 400, h: 460 }, AREAS[i]![0], f);
		contents.set(card.id, doc(...AREAS[i]![2]));
	});
	commitWithDocs(b, ydoc, contents);
}
