import type * as Y from 'yjs';
import { STICKY_COLORS } from '$lib/model/defaults';
import { TemplateBuilder } from './builder';
import { commitWithDocs, doc, h, p } from './docHelpers';

const FIELDS: [string, string][] = [
	['Role', 'Protagonist, antagonist, mentor…'],
	['Want', 'What they pursue on the surface.'],
	['Need', 'What they actually need to learn or get.'],
	['Flaw', 'What stands in their way from inside.'],
	['Arc', 'How they change from the first page to the last.'],
	['Voice', 'How they talk: words, rhythm, tics.'],
	['Backstory', 'What happened before the story that still matters.']
];

export function buildCharacterProfile(ydoc: Y.Doc): void {
	const b = new TemplateBuilder();
	const card = b.docCard({ x: 0, y: 0, w: 520, h: 760 }, 'Character name');
	const frame = b.frame(
		'Relationships',
		{ x: 580, y: 0, w: 760, h: 760 },
		{ fill: '#b197fc', fillStyle: 'semi', stroke: '#7950f2' }
	);
	const me = b.sticky(
		{ x: 580 + 290, y: 290, w: 180, h: 180 },
		'This character',
		STICKY_COLORS.violet,
		frame
	);
	const others: [string, number, number][] = [
		['Ally', 40, 40],
		['Rival', 540, 40],
		['Mentor', 40, 540],
		['Love interest', 540, 540]
	];
	for (const [label, dx, dy] of others) {
		const s = b.sticky({ x: 580 + dx, y: dy, w: 180, h: 180 }, label, STICKY_COLORS.yellow, frame);
		b.connect(me, 'float', s, 'float', {
			routing: 'straight',
			markerEnd: 'none',
			label: 'relationship'
		});
	}
	commitWithDocs(
		b,
		ydoc,
		new Map([
			[card.id, doc(h(1, 'Character name'), ...FIELDS.flatMap(([f, hint]) => [h(2, f), p(hint)]))]
		])
	);
}
