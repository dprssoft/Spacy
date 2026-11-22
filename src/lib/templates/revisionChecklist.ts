import type * as Y from 'yjs';
import { STICKY_COLORS } from '$lib/model/defaults';
import type { DocNode } from '$lib/board/doccards/markdown';
import { TemplateBuilder } from './builder';
import { commitWithDocs, doc, h, items, p } from './docHelpers';
import { checklistProgress, deadlineIn } from './widgetConfigs';

const tasks = (texts: string[]) => items('taskList', texts, 'taskItem');

export const REVISION_CHECKLIST: DocNode = doc(
	h(1, 'Revision checklist'),
	p('One pass at a time, from the big picture down to the commas.'),
	h(2, 'Structural edit'),
	tasks([
		'The opening hooks and sets up the promise',
		'Every scene has a goal, a conflict and a turn',
		'The middle keeps raising the stakes',
		'The ending pays off what was set up'
	]),
	h(2, 'Line edit'),
	tasks([
		'Cut filler words and repeated beats',
		'Each character sounds like themselves',
		'Vary sentence length and rhythm'
	]),
	h(2, 'Copy edit'),
	tasks(['Spelling and grammar', 'Names and facts are consistent', 'Formatting and punctuation'])
);

export function buildRevisionChecklist(ydoc: Y.Doc): void {
	const b = new TemplateBuilder();
	const card = b.docCard({ x: 0, y: 0, w: 520, h: 680 }, 'Revision checklist');
	b.widget('progress', { x: 580, y: 0 }, checklistProgress(card.id), { title: 'Revision' });
	b.widget('deadline', { x: 580, y: 150 }, deadlineIn(30, 'Revision due'));
	const notes = b.frame('Notes for the next pass', { x: 580, y: 300, w: 440, h: 228 });
	['Something to fix', 'Something to check'].forEach((text, i) =>
		b.sticky({ x: 604 + i * 204, y: 324, w: 180, h: 180 }, text, STICKY_COLORS.pink, notes)
	);
	commitWithDocs(b, ydoc, new Map([[card.id, REVISION_CHECKLIST]]));
}
