import type * as Y from 'yjs';
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
	return (await import('./create')).createBoardFromTemplate(t);
}
