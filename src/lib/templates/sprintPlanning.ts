import type * as Y from 'yjs';
import { STICKY_COLORS } from '$lib/model/defaults';
import { TemplateBuilder } from './builder';
import { deadlineIn } from './widgetConfigs';

const COL = { w: 380, h: 600 };
const CARD = { w: 332, h: 100 };
const COLUMNS: [string, string, string[]][] = [
	['Backlog', STICKY_COLORS.yellow, ['Story', 'Story', 'Story', 'Bug']],
	['Sprint', STICKY_COLORS.blue, ['Story · 3 pts', 'Story · 5 pts']],
	['Capacity', STICKY_COLORS.green, ['Name: 8 days', 'Name: 10 days', 'Holidays, on call']]
];

export function buildSprintPlanning(doc: Y.Doc): void {
	const b = new TemplateBuilder();
	b.text({ x: 0, y: -150, w: 600, h: 34 }, 'Sprint planning', {
		font: { size: 'l', bold: true, align: 'l' }
	});
	b.text(
		{ x: 0, y: -100, w: 820, h: 60 },
		'Sprint goal: what this sprint delivers, in one sentence',
		{
			font: { size: 'm', bold: true, align: 'l' }
		}
	);
	const frames = b.frameGrid(
		COLUMNS.map(([title]) => title),
		{ x: 0, y: 0 },
		COL,
		{ tints: ['gray', 'blue', 'green'] }
	);
	COLUMNS.forEach(([, color, notes], i) => {
		const f = frames[i]!;
		notes.forEach((text, k) =>
			b.sticky({ x: f.x + 24, y: f.y + 24 + k * (CARD.h + 16), ...CARD }, text, color, f)
		);
	});
	b.widget(
		'deadline',
		{ x: 2 * (COL.w + 40) + COL.w - 220, y: -150 },
		deadlineIn(14, 'Sprint end')
	);
	b.commit(doc);
}
