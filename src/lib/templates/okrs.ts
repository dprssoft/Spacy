import type * as Y from 'yjs';
import { PROGRESS_COLORS } from '$lib/board/widgets/progress/progress';
import { TemplateBuilder } from './builder';
import { manualProgress } from './widgetConfigs';

const FRAME = { w: 620, h: 480 };
const ROW = 130;
const OBJECTIVES: ['blue' | 'green' | 'violet', string][] = [
	['blue', PROGRESS_COLORS[0]!],
	['green', PROGRESS_COLORS[1]!],
	['violet', PROGRESS_COLORS[3]!]
];

export function buildOkrs(doc: Y.Doc): void {
	const b = new TemplateBuilder();
	b.text({ x: 0, y: -90, w: 600, h: 34 }, 'OKRs', { font: { size: 'l', bold: true, align: 'l' } });
	b.text({ x: 0, y: -50, w: 900, h: 26 }, 'Quarter: …   Owner: …', {
		font: { size: 'm', align: 'l' }
	});
	const frames = b.frameGrid(
		OBJECTIVES.map((_, i) => `Objective ${i + 1}`),
		{ x: 0, y: 0 },
		FRAME,
		{ tints: OBJECTIVES.map(([t]) => t) }
	);
	frames.forEach((f, i) => {
		b.text(
			{ x: f.x + 24, y: f.y + 24, w: FRAME.w - 48, h: 30 },
			'What do we want to achieve?',
			{
				font: { size: 'm', bold: true, align: 'l' }
			},
			f
		);
		for (let k = 0; k < 3; k++) {
			const y = f.y + 76 + k * ROW;
			b.text(
				{ x: f.x + 24, y, w: 300, h: 110 },
				`Key result ${k + 1}: measurable outcome`,
				{
					font: { size: 'm', align: 'l', valign: 'm' }
				},
				f
			);
			b.widget('progress', { x: f.x + 336, y }, manualProgress(OBJECTIVES[i]![1]), { parent: f });
		}
	});
	b.commit(doc);
}
