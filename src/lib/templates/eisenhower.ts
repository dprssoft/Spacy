import type * as Y from 'yjs';
import { STICKY_COLORS } from '$lib/model/defaults';
import { TemplateBuilder } from './builder';

const CELL = { w: 480, h: 360 };
const GAP = 40;
const QUADRANTS: [string, string, string][] = [
	['Do', 'Urgent and important', STICKY_COLORS.pink],
	['Schedule', 'Important, not urgent', STICKY_COLORS.blue],
	['Delegate', 'Urgent, not important', STICKY_COLORS.yellow],
	['Eliminate', 'Neither', STICKY_COLORS.violet]
];

export function buildEisenhower(doc: Y.Doc): void {
	const b = new TemplateBuilder();
	b.text({ x: 0, y: -130, w: 700, h: 34 }, 'Eisenhower matrix', {
		font: { size: 'l', bold: true, align: 'l' }
	});
	const axis = { font: { size: 's' as const, bold: true, color: '#868e96' } };
	b.text({ x: 0, y: -60, w: CELL.w, h: 24 }, 'Urgent', {
		...axis,
		font: { ...axis.font, align: 'c' }
	});
	b.text({ x: CELL.w + GAP, y: -60, w: CELL.w, h: 24 }, 'Not urgent', {
		...axis,
		font: { ...axis.font, align: 'c' }
	});
	b.text({ x: -150, y: CELL.h / 2 - 12, w: 130, h: 24 }, 'Important', {
		...axis,
		font: { ...axis.font, align: 'r' }
	});
	b.text({ x: -150, y: CELL.h + GAP + CELL.h / 2 - 12, w: 130, h: 24 }, 'Not important', {
		...axis,
		font: { ...axis.font, align: 'r' }
	});
	const frames = b.frameGrid(
		QUADRANTS.map(([title]) => title),
		{ x: 0, y: 0 },
		CELL,
		{ cols: 2, gap: GAP, tints: ['red', 'blue', 'yellow', 'violet'] }
	);
	QUADRANTS.forEach(([, hint, color], i) => {
		const f = frames[i]!;
		b.sticky({ x: f.x + 24, y: f.y + 24, w: 170, h: 170 }, hint, color, f);
	});
	b.commit(doc);
}
