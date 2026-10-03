import type * as Y from 'yjs';
import { STICKY_COLORS } from '$lib/model/defaults';
import { TemplateBuilder } from './builder';

const SPAN = 1400;
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
const COLORS = [STICKY_COLORS.yellow, STICKY_COLORS.blue, STICKY_COLORS.green, STICKY_COLORS.pink];
const STICKY = 150;

export function buildTimeline(doc: Y.Doc): void {
	const b = new TemplateBuilder();
	b.text({ x: 0, y: -330, w: 600, h: 34 }, 'Roadmap', {
		font: { size: 'l', bold: true, align: 'l' }
	});
	b.shape('rect', { x: 0, y: -3, w: SPAN, h: 6 }, '', {
		style: { fill: '#495057', fillStyle: 'solid', stroke: 'transparent', radius: 'none' }
	});
	QUARTERS.forEach((q, i) => {
		const x = (SPAN / QUARTERS.length) * (i + 0.5);
		const dot = b.shape('ellipse', { x: x - 14, y: -14, w: 28, h: 28 }, '', {
			style: { fill: '#ffffff', fillStyle: 'solid', stroke: '#495057', strokeWidth: 4 }
		});
		const above = i % 2 === 0;
		// The label goes on the side without a milestone line.
		b.text({ x: x - 60, y: above ? 24 : -52, w: 120, h: 28 }, q, {
			font: { size: 'm', bold: true, align: 'c' }
		});
		const sticky = b.sticky(
			{ x: x - STICKY / 2, y: above ? -60 - STICKY - 80 : 80 + 60, w: STICKY, h: STICKY },
			`Milestone ${i + 1}`,
			COLORS[i]!
		);
		b.connect(dot, above ? 'n' : 's', sticky, above ? 's' : 'n', {
			routing: 'straight',
			markerEnd: 'none'
		});
	});
	b.commit(doc);
}
