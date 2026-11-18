import type * as Y from 'yjs';
import { STICKY_COLORS } from '$lib/model/defaults';
import { TemplateBuilder } from './builder';

const CELL = { w: 480, h: 360 };
const GAP = 40;
// Rows: high power, then low; columns: low interest, then high.
const QUADRANTS: [string, string, string][] = [
	['Keep satisfied', 'Consult on big decisions', STICKY_COLORS.orange],
	['Manage closely', 'Involve and update often', STICKY_COLORS.pink],
	['Monitor', 'Check in now and then', STICKY_COLORS.green],
	['Keep informed', 'Share progress regularly', STICKY_COLORS.blue]
];

export function buildStakeholderMap(doc: Y.Doc): void {
	const b = new TemplateBuilder();
	b.text({ x: 0, y: -130, w: 700, h: 34 }, 'Stakeholder map', {
		font: { size: 'l', bold: true, align: 'l' }
	});
	const axis = { size: 's' as const, bold: true, color: '#868e96' };
	b.text({ x: 0, y: -60, w: CELL.w, h: 24 }, 'Low interest', { font: { ...axis, align: 'c' } });
	b.text({ x: CELL.w + GAP, y: -60, w: CELL.w, h: 24 }, 'High interest', {
		font: { ...axis, align: 'c' }
	});
	b.text({ x: -150, y: CELL.h / 2 - 12, w: 130, h: 24 }, 'High power', {
		font: { ...axis, align: 'r' }
	});
	b.text({ x: -150, y: CELL.h + GAP + CELL.h / 2 - 12, w: 130, h: 24 }, 'Low power', {
		font: { ...axis, align: 'r' }
	});
	const frames = b.frameGrid(
		QUADRANTS.map(([title]) => title),
		{ x: 0, y: 0 },
		CELL,
		{ cols: 2, gap: GAP, tints: ['orange', 'red', 'green', 'blue'] }
	);
	QUADRANTS.forEach(([, hint, color], i) => {
		const f = frames[i]!;
		b.sticky({ x: f.x + 24, y: f.y + 24, w: 170, h: 170 }, `Stakeholder\n${hint}`, color, f);
	});
	b.commit(doc);
}
