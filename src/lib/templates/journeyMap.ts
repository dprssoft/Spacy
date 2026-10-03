import type * as Y from 'yjs';
import { STICKY_COLORS } from '$lib/model/defaults';
import { TemplateBuilder } from './builder';

const STAGES = ['Discover', 'Consider', 'Buy', 'Use', 'Recommend'];
const ROWS: [string, string][] = [
	['Actions', STICKY_COLORS.yellow],
	['Thoughts', STICKY_COLORS.blue],
	['Feelings', STICKY_COLORS.pink],
	['Opportunities', STICKY_COLORS.green]
];
const LABEL_W = 180;
const COL_W = 220;
const ROW_H = 190;
const HEAD_H = 70;
const STICKY = 150;

export function buildJourneyMap(doc: Y.Doc): void {
	const b = new TemplateBuilder();
	const w = LABEL_W + STAGES.length * COL_W + 20;
	const h = HEAD_H + ROWS.length * ROW_H + 20;
	const frame = b.frame('User journey map', { x: 0, y: 0, w, h });
	STAGES.forEach((stage, i) =>
		b.text(
			{ x: LABEL_W + i * COL_W, y: 20, w: COL_W, h: 30 },
			stage,
			{ font: { size: 'm', bold: true, align: 'c' } },
			frame
		)
	);
	ROWS.forEach(([row, color], r) => {
		const y = HEAD_H + r * ROW_H;
		b.text(
			{ x: 20, y: y + ROW_H / 2 - 15, w: LABEL_W - 30, h: 30 },
			row,
			{ font: { size: 'm', bold: true, align: 'l', color: '#868e96' } },
			frame
		);
		STAGES.forEach((_, i) =>
			b.sticky(
				{
					x: LABEL_W + i * COL_W + (COL_W - STICKY) / 2,
					y: y + (ROW_H - STICKY) / 2,
					w: STICKY,
					h: STICKY
				},
				'',
				color,
				frame
			)
		);
	});
	b.commit(doc);
}
