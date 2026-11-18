import type * as Y from 'yjs';
import { STICKY_COLORS } from '$lib/model/defaults';
import type { DocNode } from '$lib/board/doccards/markdown';
import { TemplateBuilder } from './builder';
import { commitWithDocs, doc as docNode, h, items, p } from './docHelpers';
import { checklistProgress, deadlineIn } from './widgetConfigs';

export const ONE_ON_ONE: DocNode = docNode(
	h(1, '1:1 meeting'),
	p('Date: …'),
	h(2, 'Check-in'),
	p('How are things going?'),
	h(2, 'Agenda'),
	items('bulletList', ['Their topics', 'My topics', 'Growth and feedback']),
	h(2, 'Notes'),
	p('What we talked about.'),
	h(2, 'Action items'),
	items('taskList', ['Owner: task', 'Owner: task', 'Owner: task'], 'taskItem')
);

export function buildOneOnOne(doc: Y.Doc): void {
	const b = new TemplateBuilder();
	const card = b.docCard({ x: 0, y: 0, w: 480, h: 620 }, '1:1 meeting');
	b.widget('progress', { x: 540, y: 0 }, checklistProgress(card.id), { title: 'Action items' });
	b.widget('deadline', { x: 540, y: 150 }, deadlineIn(7, 'Next 1:1'));
	const later = b.frame('Next time', { x: 540, y: 300, w: 440, h: 228 });
	['Topic to bring up', 'Topic to bring up'].forEach((text, i) =>
		b.sticky({ x: 564 + i * 204, y: 324, w: 180, h: 180 }, text, STICKY_COLORS.yellow, later)
	);
	commitWithDocs(b, doc, new Map([[card.id, ONE_ON_ONE]]));
}
