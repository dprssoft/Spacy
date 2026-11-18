import type * as Y from 'yjs';
import { STICKY_COLORS } from '$lib/model/defaults';
import { TemplateBuilder } from './builder';

const TASK_W = 260;
const CELL = { w: 170, h: 90 };
const LETTER = 60;
const ROLES = ['Lead', 'Developer', 'Designer', 'Stakeholder'];
const TASKS = ['Define scope', 'Design', 'Build', 'Test', 'Launch'];
const ROLE_KEY: Record<string, [string, string]> = {
	R: ['Responsible: does the work', STICKY_COLORS.pink],
	A: ['Accountable: owns the outcome', STICKY_COLORS.orange],
	C: ['Consulted: gives input', STICKY_COLORS.blue],
	I: ['Informed: kept up to date', STICKY_COLORS.green]
};
// One letter per role for each task (a starting point to edit).
const MATRIX = ['ARCI', 'ACRI', 'ARCI', 'ARIC', 'RCIA'];

export function buildRaci(doc: Y.Doc): void {
	const b = new TemplateBuilder();
	b.text({ x: 0, y: -90, w: 600, h: 34 }, 'RACI matrix', {
		font: { size: 'l', bold: true, align: 'l' }
	});
	const header = { style: { fill: '#e9ecef', font: { bold: true } } };
	b.shape('rect', { x: 0, y: 0, w: TASK_W, h: CELL.h }, 'Task', header);
	ROLES.forEach((role, c) =>
		b.shape('rect', { x: TASK_W + c * CELL.w, y: 0, ...CELL }, role, header)
	);
	TASKS.forEach((task, r) => {
		const y = (r + 1) * CELL.h;
		b.shape('rect', { x: 0, y, w: TASK_W, h: CELL.h }, task, {
			style: { font: { align: 'l' } }
		});
		ROLES.forEach((_, c) => {
			const x = TASK_W + c * CELL.w;
			b.shape('rect', { x, y, ...CELL }, '');
			const letter = MATRIX[r]![c]!;
			b.sticky(
				{ x: x + (CELL.w - LETTER) / 2, y: y + (CELL.h - LETTER) / 2, w: LETTER, h: LETTER },
				letter,
				ROLE_KEY[letter]![1]
			);
		});
	});
	const legendX = TASK_W + ROLES.length * CELL.w + 80;
	const legend = b.frame('Legend', { x: legendX, y: 0, w: 300, h: 4 * 110 + 40 });
	Object.entries(ROLE_KEY).forEach(([letter, [meaning, color]], i) =>
		b.sticky(
			{ x: legendX + 24, y: 24 + i * 110, w: 252, h: 96 },
			`${letter} · ${meaning}`,
			color,
			legend
		)
	);
	b.commit(doc);
}
