import type * as Y from 'yjs';
import { STICKY_COLORS } from '$lib/model/defaults';
import { TemplateBuilder, type Tint } from './builder';

const ROWS: [string, Tint, string, [string, string][]][] = [
	[
		'Act 1',
		'blue',
		STICKY_COLORS.blue,
		[
			['Opening image', '1 %'],
			['Theme stated', '5 %'],
			['Set-up', '1–10 %'],
			['Catalyst', '10 %'],
			['Debate', '10–20 %']
		]
	],
	[
		'Act 2A',
		'yellow',
		STICKY_COLORS.yellow,
		[
			['Break into Two', '20 %'],
			['B story', '22 %'],
			['Fun and games', '20–50 %'],
			['Midpoint', '50 %']
		]
	],
	[
		'Act 2B',
		'orange',
		STICKY_COLORS.orange,
		[
			['Bad guys close in', '50–75 %'],
			['All is lost', '75 %'],
			['Dark night of the soul', '75–80 %']
		]
	],
	[
		'Act 3',
		'green',
		STICKY_COLORS.green,
		[
			['Break into Three', '80 %'],
			['Finale', '80–99 %'],
			['Final image', '99–100 %']
		]
	]
];
const CARD = 190;
const GAP = 20;

export function buildSaveTheCat(ydoc: Y.Doc): void {
	const b = new TemplateBuilder();
	b.text({ x: 0, y: -90, w: 700, h: 34 }, 'Save the Cat! beat sheet', {
		font: { size: 'l', bold: true, align: 'l' }
	});
	const width = 5 * (CARD + GAP) + GAP;
	ROWS.forEach(([title, tint, color, beats], r) => {
		const [frame] = b.frameGrid(
			[title],
			{ x: 0, y: r * (CARD + GAP * 2 + 40) },
			{ w: width, h: CARD + GAP * 2 },
			{ tints: [tint] }
		);
		beats.forEach(([beat, pct], i) =>
			b.sticky(
				{ x: frame!.x + GAP + i * (CARD + GAP), y: frame!.y + GAP, w: CARD, h: CARD },
				`${beat}\n(${pct})`,
				color,
				frame
			)
		);
	});
	b.commit(ydoc);
}
