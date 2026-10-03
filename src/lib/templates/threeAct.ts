import type * as Y from 'yjs';
import { STICKY_COLORS } from '$lib/model/defaults';
import { TemplateBuilder } from './builder';
import { commitWithDocs, doc, h, p } from './docHelpers';

const H = 640;
const UNIT = 480; // Act II is twice as long as Acts I and III.
const GAP = 40;
const STICKY = 180;

export function buildThreeAct(ydoc: Y.Doc): void {
	const b = new TemplateBuilder();
	const logline = b.docCard({ x: 0, y: -420, w: 720, h: 320 }, 'Logline');
	const [a1, a2, a3] = [
		b.frame(
			'Act I — Setup',
			{ x: 0, y: 0, w: UNIT, h: H },
			{ fill: '#74c0fc', fillStyle: 'semi', stroke: '#228be6' }
		),
		b.frame(
			'Act II — Confrontation',
			{ x: UNIT + GAP, y: 0, w: UNIT * 2, h: H },
			{ fill: '#ffe066', fillStyle: 'semi', stroke: '#fab005' }
		),
		b.frame(
			'Act III — Resolution',
			{ x: UNIT * 3 + GAP * 2, y: 0, w: UNIT, h: H },
			{ fill: '#8ce99a', fillStyle: 'semi', stroke: '#40c057' }
		)
	];
	const beat = (
		f: { id: string; x: number; y: number },
		dx: number,
		dy: number,
		text: string,
		color: string
	) => b.sticky({ x: f.x + dx, y: f.y + dy, w: STICKY, h: STICKY }, text, color, f);
	beat(a1!, 30, 40, 'Inciting incident\n(~10 %)', STICKY_COLORS.blue);
	beat(a1!, 270, 400, 'Plot point 1\n(~25 %)', STICKY_COLORS.blue);
	beat(a2!, 390, 230, 'Midpoint\n(~50 %)', STICKY_COLORS.yellow);
	beat(a2!, 730, 400, 'Plot point 2\n(~75 %)', STICKY_COLORS.yellow);
	beat(a3!, 30, 40, 'Climax\n(~90 %)', STICKY_COLORS.green);
	beat(a3!, 270, 400, 'Resolution', STICKY_COLORS.green);
	commitWithDocs(
		b,
		ydoc,
		new Map([
			[
				logline.id,
				doc(
					h(2, 'Logline'),
					p('When [inciting incident], a [protagonist] must [goal], or else [stakes].'),
					h(3, 'Theme'),
					p('What is this story really about?')
				)
			]
		])
	);
}
