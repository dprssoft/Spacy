import type * as Y from 'yjs';
import { STICKY_COLORS } from '$lib/model/defaults';
import { TemplateBuilder } from './builder';

const COL = { w: 360, h: 600 };
const STICKY = 150;
const COLUMNS: [string, string, string[]][] = [
	['Went well', STICKY_COLORS.green, ['What helped us?', 'Shout-outs']],
	['To improve', STICKY_COLORS.pink, ['What slowed us down?', 'What confused us?']],
	['Action items', STICKY_COLORS.blue, ['Who does what?', 'By when?']]
];

export function buildRetrospective(doc: Y.Doc): void {
	const b = new TemplateBuilder();
	b.text({ x: 0, y: -100, w: 700, h: 34 }, 'Retrospective', {
		font: { size: 'l', bold: true, align: 'l' }
	});
	b.text({ x: 0, y: -60, w: 700, h: 26 }, 'Sprint: …   Date: …', {
		font: { size: 'm', align: 'l' }
	});
	const frames = b.frameGrid(
		COLUMNS.map(([title]) => title),
		{ x: 0, y: 0 },
		COL,
		{ tints: ['green', 'red', 'blue'] }
	);
	COLUMNS.forEach(([, color, prompts], i) => {
		const f = frames[i]!;
		prompts.forEach((text, k) =>
			b.sticky(
				{ x: f.x + 24 + k * (STICKY + 12), y: f.y + 24, w: STICKY, h: STICKY },
				text,
				color,
				f
			)
		);
	});
	b.commit(doc);
}
