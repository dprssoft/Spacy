import type * as Y from 'yjs';
import { STICKY_COLORS } from '$lib/model/defaults';
import { getDocsMap } from '$lib/model/doc';
import { TEMPLATE } from '$lib/model/origins';
import type { DocNode } from '$lib/board/doccards/markdown';
import { TemplateBuilder } from './builder';
import { writeDocJSON } from '$lib/board/doccards/fragmentWrite';
import { h, items, p } from './docHelpers';

export const MEETING_NOTES: DocNode = {
	type: 'doc',
	content: [
		h(1, 'Meeting notes'),
		p('Date: …'),
		h(2, 'Attendees'),
		items('bulletList', ['Name', 'Name']),
		h(2, 'Agenda'),
		items('orderedList', ['Topic one', 'Topic two', 'Topic three']),
		h(2, 'Notes'),
		p('What was discussed.'),
		h(2, 'Action items'),
		items('taskList', ['Owner: task', 'Owner: task', 'Owner: task'], 'taskItem')
	]
};

export function buildMeetingNotes(doc: Y.Doc): void {
	const b = new TemplateBuilder();
	const card = b.docCard({ x: 0, y: 0, w: 480, h: 560 }, 'Meeting notes');
	const frame = b.frame('Decisions', { x: 600, y: 60, w: 440, h: 440 });
	const colors = [STICKY_COLORS.green, STICKY_COLORS.blue, STICKY_COLORS.yellow];
	['Decision', 'Decision', 'Decision'].forEach((text, i) =>
		b.sticky(
			{ x: 640 + (i % 2) * 200, y: 100 + Math.floor(i / 2) * 200, w: 160, h: 160 },
			text,
			colors[i]!,
			frame
		)
	);
	b.connect(card, 'e', frame, 'w', { label: 'decisions' });
	doc.transact(() => {
		b.commit(doc);
		writeDocJSON(getDocsMap(doc).get(card.id)!, MEETING_NOTES);
	}, TEMPLATE);
}
