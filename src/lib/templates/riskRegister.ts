import type * as Y from 'yjs';
import { STICKY_COLORS } from '$lib/model/defaults';
import { TemplateBuilder } from './builder';
import { statusChip } from './widgetConfigs';

const ROW = 124;
const RISKS = ['Risk: what could go wrong', 'Risk', 'Risk', 'Risk'];
const STATUS: [string, string][] = [
	['Open', '#e03131'],
	['Mitigating', '#f08c00'],
	['Closed', '#2f9e44'],
	['Accepted', '#868e96']
];
const CELL = { w: 160, h: 120 };
const LEVELS = ['Low', 'Medium', 'High'];
// Likelihood + impact (0..4): low, medium, high.
const HEAT = ['#b2f2bb', '#b2f2bb', '#ffec99', '#ffc9c9', '#ffc9c9'];

export function buildRiskRegister(doc: Y.Doc): void {
	const b = new TemplateBuilder();
	b.text({ x: 0, y: -90, w: 600, h: 34 }, 'Risk register', {
		font: { size: 'l', bold: true, align: 'l' }
	});
	const list = b.frame('Risks', { x: 0, y: 0, w: 520, h: 24 + RISKS.length * ROW });
	RISKS.forEach((text, i) => {
		const y = 24 + i * ROW;
		b.sticky({ x: 24, y, w: 300, h: 100 }, text, STICKY_COLORS.yellow, list);
		b.widget('status', { x: 360, y: y + 34 }, statusChip(STATUS), { parent: list });
	});

	const gx = 760;
	const axis = { font: { size: 's' as const, bold: true, color: '#868e96' } };
	b.text({ x: gx, y: -40, w: 3 * CELL.w, h: 26 }, 'Likelihood × impact', {
		font: { size: 'm', bold: true, align: 'l' }
	});
	for (let l = 0; l < 3; l++) {
		const y = (2 - l) * CELL.h;
		b.text({ x: gx - 110, y: y + CELL.h / 2 - 12, w: 100, h: 24 }, LEVELS[l]!, {
			...axis,
			font: { ...axis.font, align: 'r' }
		});
		for (let i = 0; i < 3; i++)
			b.shape('rect', { x: gx + i * CELL.w, y, ...CELL }, '', {
				style: { fill: HEAT[l + i]!, fillStyle: 'solid', stroke: '#ffffff' }
			});
	}
	LEVELS.forEach((level, i) =>
		b.text({ x: gx + i * CELL.w, y: 3 * CELL.h + 8, w: CELL.w, h: 24 }, level, {
			...axis,
			font: { ...axis.font, align: 'c' }
		})
	);
	b.text({ x: gx, y: 3 * CELL.h + 40, w: 3 * CELL.w, h: 24 }, 'Impact →', {
		...axis,
		font: { ...axis.font, align: 'c' }
	});
	b.text({ x: gx - 110, y: -40, w: 100, h: 24 }, 'Likelihood ↑', {
		...axis,
		font: { ...axis.font, align: 'r' }
	});
	b.commit(doc);
}
