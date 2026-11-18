import type * as Y from 'yjs';
import { STICKY_COLORS } from '$lib/model/defaults';
import { TemplateBuilder } from './builder';
import { deadlineIn } from './widgetConfigs';

const COL = { w: 420, h: 560 };
const STICKY = 168;
const COLUMNS: [string, string, number, string[]][] = [
	['Now', STICKY_COLORS.green, 14, ['In progress', 'Committed', 'Quick win']],
	['Next', STICKY_COLORS.blue, 60, ['Planned', 'Needs design', 'Depends on Now']],
	['Later', STICKY_COLORS.violet, 120, ['Idea', 'Exploring', 'Big bet']]
];

export function buildRoadmap(doc: Y.Doc): void {
	const b = new TemplateBuilder();
	b.text({ x: 0, y: -90, w: 700, h: 34 }, 'Roadmap', {
		font: { size: 'l', bold: true, align: 'l' }
	});
	const frames = b.frameGrid(
		COLUMNS.map(([title]) => title),
		{ x: 0, y: 0 },
		COL,
		{ tints: ['green', 'blue', 'violet'] }
	);
	COLUMNS.forEach(([title, color, days, notes], i) => {
		const f = frames[i]!;
		notes.forEach((text, k) =>
			b.sticky(
				{
					x: f.x + 30 + (k % 2) * (STICKY + 24),
					y: f.y + 24 + Math.floor(k / 2) * (STICKY + 24),
					w: STICKY,
					h: STICKY
				},
				text,
				color,
				f
			)
		);
		b.widget(
			'deadline',
			{ x: f.x + 30, y: f.y + COL.h - 110 - 24 },
			deadlineIn(days, `${title}: target`),
			{
				parent: f
			}
		);
	});
	b.commit(doc);
}
