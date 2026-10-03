import type * as Y from 'yjs';
import { STICKY_COLORS } from '$lib/model/defaults';
import { TemplateBuilder } from './builder';

const STAGES = [
	'Ordinary world',
	'Call to adventure',
	'Refusal of the call',
	'Meeting the mentor',
	'Crossing the threshold',
	'Tests, allies, enemies',
	'Approach to the inmost cave',
	'The ordeal',
	'Reward',
	'The road back',
	'Resurrection',
	'Return with the elixir'
];
const RADIUS = 520;
const STICKY = 170;

export function buildHerosJourney(ydoc: Y.Doc): void {
	const b = new TemplateBuilder();
	b.text({ x: -300, y: -40, w: 600, h: 34 }, "The Hero's Journey", {
		font: { size: 'l', bold: true, align: 'c' }
	});
	const colors = [
		STICKY_COLORS.blue,
		STICKY_COLORS.yellow,
		STICKY_COLORS.pink,
		STICKY_COLORS.green
	];
	const stickies = STAGES.map((stage, i) => {
		const a = -Math.PI / 2 + (i * 2 * Math.PI) / STAGES.length;
		return b.sticky(
			{
				x: Math.cos(a) * RADIUS - STICKY / 2,
				y: Math.sin(a) * RADIUS - STICKY / 2,
				w: STICKY,
				h: STICKY
			},
			`${i + 1}. ${stage}`,
			colors[Math.floor(i / 3)]!
		);
	});
	stickies.forEach((s, i) =>
		b.connect(s, 'float', stickies[(i + 1) % stickies.length]!, 'float', { routing: 'curve' })
	);
	b.commit(ydoc);
}
