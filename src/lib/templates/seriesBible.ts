import type * as Y from 'yjs';
import type { DocNode } from '$lib/board/doccards/markdown';
import { TemplateBuilder } from './builder';
import { commitWithDocs, doc, h, p } from './docHelpers';

const FRAME = { w: 720, h: 420 };
const CARD = { w: 318, h: 340 };
const PAD = 28;
const SECTIONS: [string, [string, string[]][]][] = [
	[
		'Characters',
		[
			['Protagonist', ['Wants: ', 'Needs: ', 'Secret: ', 'First appears: ']],
			['Antagonist', ['Wants: ', 'Why they oppose: ', 'First appears: ']]
		]
	],
	[
		'Places',
		[
			['Home town', ['Looks like: ', 'Who lives here: ', 'Sounds and smells: ']],
			['The city', ['Looks like: ', 'Who rules it: ', 'Where the story goes here: ']]
		]
	],
	[
		'Timeline',
		[
			['Before the series', ['What happened: ', 'Who remembers it: ']],
			['Book 1', ['Starts: ', 'Ends: ', 'What changes: ']]
		]
	],
	[
		'Rules',
		[
			['How the world works', ['Magic, technology or law: ', 'What it costs: ']],
			['Never break', ['Things that can’t happen in this world: ']]
		]
	]
];

/** Frames of reference cards, with connectors for how they relate. */
export function buildSeriesBible(ydoc: Y.Doc): void {
	const b = new TemplateBuilder();
	b.text({ x: 0, y: -90, w: 700, h: 34 }, 'Series bible', {
		font: { size: 'l', bold: true, align: 'l' }
	});
	const frames = b.frameGrid(
		SECTIONS.map(([title]) => title),
		{ x: 0, y: 0 },
		FRAME,
		{ cols: 2, gap: 120, tints: ['violet', 'green', 'blue', 'orange'] }
	);
	const contents = new Map<string, DocNode>();
	const cards = SECTIONS.map(([, entries], i) => {
		const f = frames[i]!;
		return entries.map(([title, lines], k) => {
			const card = b.docCard(
				{ x: f.x + PAD + k * (CARD.w + 28), y: f.y + PAD + 12, ...CARD },
				title,
				f
			);
			contents.set(card.id, doc(h(2, title), ...lines.map(p)));
			return card;
		});
	});
	const [characters, places, timeline, rules] = cards as [
		(typeof cards)[0],
		(typeof cards)[0],
		(typeof cards)[0],
		(typeof cards)[0]
	];
	b.connect(characters[1]!, 'e', places[0]!, 'w', { label: 'lives in' });
	b.connect(timeline[0]!, 'n', characters[0]!, 's', { label: 'shapes' });
	b.connect(rules[0]!, 'n', places[0]!, 's', { label: 'applies in' });
	commitWithDocs(b, ydoc, contents);
}
