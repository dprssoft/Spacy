import type * as Y from 'yjs';
import { STICKY_COLORS } from '$lib/model/defaults';
import { getDocsMap } from '$lib/model/doc';
import { TEMPLATE } from '$lib/model/origins';
import type { DocNode } from '$lib/board/doccards/markdown';
import { TemplateBuilder } from './builder';
import { setDocContent } from './docContent';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const COL = { w: 260, h: 560 };
const GAP = 24;

const NOTES: DocNode = {
	type: 'doc',
	content: [
		{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'This week' }] },
		{
			type: 'taskList',
			content: ['Top priority', 'Second priority', 'Nice to have'].map((text) => ({
				type: 'taskItem',
				attrs: { checked: false },
				content: [{ type: 'paragraph', content: [{ type: 'text', text }] }]
			}))
		}
	]
};

export function buildWeeklyPlanner(doc: Y.Doc): void {
	const b = new TemplateBuilder();
	b.text({ x: 0, y: -90, w: 600, h: 34 }, 'Weekly planner', {
		font: { size: 'l', bold: true, align: 'l' }
	});
	const frames = b.frameGrid(DAYS, { x: 0, y: 0 }, COL, { gap: GAP, tints: ['blue'] });
	frames.forEach((f) =>
		b.sticky({ x: f.x + 20, y: f.y + 20, w: COL.w - 40, h: 100 }, 'Plan', STICKY_COLORS.yellow, f)
	);
	const card = b.docCard({ x: DAYS.length * (COL.w + GAP) + 16, y: 0, w: 360, h: COL.h }, 'Notes');
	doc.transact(() => {
		b.commit(doc);
		setDocContent(getDocsMap(doc).get(card.id)!, NOTES);
	}, TEMPLATE);
}
