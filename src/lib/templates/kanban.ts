import type * as Y from 'yjs';
import { STICKY_COLORS } from '$lib/model/defaults';
import { TemplateBuilder } from './builder';

const COL = { w: 320, h: 720 };
const CARD = { w: 280, h: 110 };
const COLUMNS: [string, number, string][] = [
	['To do', 3, STICKY_COLORS.yellow],
	['In progress', 2, STICKY_COLORS.blue],
	['Done', 1, STICKY_COLORS.green]
];

export function buildKanban(doc: Y.Doc): void {
	const b = new TemplateBuilder();
	b.text({ x: 0, y: -90, w: 600, h: 34 }, 'Kanban board', {
		font: { size: 'l', bold: true, align: 'l' }
	});
	const frames = b.frameGrid(
		COLUMNS.map(([title]) => title),
		{ x: 0, y: 0 },
		COL,
		{ tints: ['gray', 'blue', 'green'] }
	);
	COLUMNS.forEach(([, count, color], i) => {
		const f = frames[i]!;
		for (let k = 0; k < count; k++)
			b.sticky(
				{ x: f.x + 20, y: f.y + 20 + k * (CARD.h + 12), ...CARD },
				count > 1 ? `Task ${k + 1}` : 'Task',
				color,
				f
			);
	});
	b.commit(doc);
}
