import type * as Y from 'yjs';
import { STICKY_COLORS } from '$lib/model/defaults';
import { TemplateBuilder } from './builder';

const CHAPTERS = 8;
const STICKY = 150;
const GAP = 16;
const PAD = 24;
const ROWS: [string, string, string, 'yellow' | 'blue' | 'green'][] = [
	['A plot: the main story', 'Main story', STICKY_COLORS.yellow, 'yellow'],
	['B plot: the relationship', 'Relationship', STICKY_COLORS.blue, 'blue'],
	['C plot: the subplot', 'Subplot', STICKY_COLORS.green, 'green']
];

export function buildPlotGrid(doc: Y.Doc): void {
	const b = new TemplateBuilder();
	b.text({ x: 0, y: -130, w: 700, h: 34 }, 'Plot grid', {
		font: { size: 'l', bold: true, align: 'l' }
	});
	const col = (i: number) => PAD + i * (STICKY + GAP);
	for (let i = 0; i < CHAPTERS; i++)
		b.text({ x: col(i), y: -60, w: STICKY, h: 24 }, `Chapter ${i + 1}`, {
			font: { size: 's', bold: true, color: '#868e96', align: 'c' }
		});
	const size = { w: col(CHAPTERS) - GAP + PAD, h: STICKY + 2 * PAD };
	const frames = b.frameGrid(
		ROWS.map(([title]) => title),
		{ x: 0, y: 0 },
		size,
		{ cols: 1, tints: ROWS.map(([, , , t]) => t) }
	);
	ROWS.forEach(([, text, color], r) => {
		const f = frames[r]!;
		for (let i = 0; i < CHAPTERS; i++)
			b.sticky({ x: f.x + col(i), y: f.y + PAD, w: STICKY, h: STICKY }, text, color, f);
	});
	b.commit(doc);
}
