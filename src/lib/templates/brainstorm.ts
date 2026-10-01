import type * as Y from 'yjs';
import { STICKY_COLORS } from '$lib/model/defaults';
import { TemplateBuilder } from './builder';

const PROMPTS = ['Idea', 'Question', 'Risk', 'Goal', 'Resource', 'Next step'];
const RADIUS = 320;
const STICKY = 160;

export function buildBrainstorm(doc: Y.Doc): void {
	const b = new TemplateBuilder();
	const c = { x: 480, y: 560 };
	const frame = b.frame('Brainstorm', { x: 0, y: 0, w: 960, h: 1060 });
	b.text(
		{ x: c.x - 200, y: 40, w: 400, h: 34 },
		'Brainstorm: Topic',
		{ font: { size: 'l', bold: true, align: 'c' } },
		frame
	);
	const topic = b.shape('ellipse', { x: c.x - 110, y: c.y - 65, w: 220, h: 130 }, 'Topic', {
		parent: frame,
		style: { fill: '#d0bfff', stroke: '#6741d9', font: { size: 'l', bold: true } }
	});
	const colors = Object.values(STICKY_COLORS);
	PROMPTS.forEach((prompt, i) => {
		const a = -Math.PI / 2 + (i * Math.PI) / 3;
		const sticky = b.sticky(
			{
				x: c.x + Math.cos(a) * RADIUS - STICKY / 2,
				y: c.y + Math.sin(a) * RADIUS - STICKY / 2,
				w: STICKY,
				h: STICKY
			},
			prompt,
			colors[i % colors.length]!,
			frame
		);
		b.connect(topic, 'float', sticky, 'float', { routing: 'curve', markerEnd: 'none' });
	});
	b.commit(doc);
}
