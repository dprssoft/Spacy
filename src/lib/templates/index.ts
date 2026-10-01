import * as Y from 'yjs';
import { getMeta } from '$lib/model/doc';
import { migrate } from '$lib/model/migrations';
import { TEMPLATE } from '$lib/model/origins';
import { writeSnapshot } from '$lib/storage/boardDoc';
import * as boardsRepo from '$lib/storage/boardsRepo';
import type { BoardMeta } from '$lib/storage/types';

// Template metadata is small and eager; builders and rendering load on first use (they pull in
// the diagram, rendering and rich-text code).

export interface Template {
	id: string;
	name: string;
	description: string;
	build(doc: Y.Doc): void | Promise<void>;
}

export const templates: Template[] = [
	{
		id: 'flowchart',
		name: 'Flowchart',
		description: 'Start, steps and a decision, already connected',
		build: async (doc) => (await import('./flowchart')).buildFlowchart(doc)
	},
	{
		id: 'brainstorm',
		name: 'Brainstorm',
		description: 'A topic with six sticky prompts around it',
		build: async (doc) => (await import('./brainstorm')).buildBrainstorm(doc)
	},
	{
		id: 'meeting-notes',
		name: 'Meeting notes',
		description: 'Agenda, notes and action items, plus decisions',
		build: async (doc) => (await import('./meetingNotes')).buildMeetingNotes(doc)
	}
];

/** A new board filled from a template, with its start-page thumbnail ready. */
export async function createBoardFromTemplate(t: Template): Promise<BoardMeta> {
	const doc = new Y.Doc();
	migrate(doc);
	await t.build(doc);
	const meta = await boardsRepo.create({ title: t.name });
	doc.transact(() => getMeta(doc).set('title', meta.title), TEMPLATE);
	await writeSnapshot(meta.id, Y.encodeStateAsUpdate(doc));
	try {
		const { thumbnailForDoc } = await import('./preview');
		const thumb = await thumbnailForDoc(doc);
		if (thumb) await boardsRepo.setThumbnail(meta.id, thumb);
	} catch (err) {
		console.error('Template thumbnail failed', err);
	}
	doc.destroy();
	return meta;
}
