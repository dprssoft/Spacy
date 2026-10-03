import type * as Y from 'yjs';
import { STICKY_COLORS } from '$lib/model/defaults';
import { TemplateBuilder } from './builder';

const CELL = { w: 520, h: 400 };
const QUADRANTS: [string, string, string][] = [
	['Strengths', 'What do we do well?', STICKY_COLORS.green],
	['Weaknesses', 'Where do we fall short?', STICKY_COLORS.pink],
	['Opportunities', 'What could we take advantage of?', STICKY_COLORS.blue],
	['Threats', 'What could hurt us?', STICKY_COLORS.orange]
];

export function buildSwot(doc: Y.Doc): void {
	const b = new TemplateBuilder();
	b.text({ x: 0, y: -90, w: 600, h: 34 }, 'SWOT analysis', {
		font: { size: 'l', bold: true, align: 'l' }
	});
	const frames = b.frameGrid(
		QUADRANTS.map(([title]) => title),
		{ x: 0, y: 0 },
		CELL,
		{ cols: 2, tints: ['green', 'red', 'blue', 'orange'] }
	);
	QUADRANTS.forEach(([, prompt, color], i) => {
		const f = frames[i]!;
		b.sticky({ x: f.x + 24, y: f.y + 24, w: 180, h: 180 }, prompt, color, f);
	});
	b.commit(doc);
}
