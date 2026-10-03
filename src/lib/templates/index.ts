import type * as Y from 'yjs';
import type { BoardMeta } from '$lib/storage/types';

// Template metadata is small and eager; builders and rendering load on first use (they pull in
// the diagram, rendering and rich-text code).

export type TemplateCategory = 'Planning' | 'Diagrams' | 'Workshops' | 'Strategy' | 'Notes';
export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
	'Planning',
	'Diagrams',
	'Workshops',
	'Strategy',
	'Notes'
];

export interface Template {
	id: string;
	name: string;
	description: string;
	category: TemplateCategory;
	/** Extra words the gallery search matches. */
	keywords: string[];
	/** Shown on the start page (the rest are in "More templates"). */
	featured: boolean;
	build(doc: Y.Doc): void | Promise<void>;
}

export const templates: Template[] = [
	{
		id: 'flowchart',
		name: 'Flowchart',
		description: 'Start, steps and a decision, already connected',
		category: 'Diagrams',
		keywords: ['process', 'diagram', 'decision', 'workflow'],
		featured: true,
		build: async (doc) => (await import('./flowchart')).buildFlowchart(doc)
	},
	{
		id: 'brainstorm',
		name: 'Brainstorm',
		description: 'A topic with six sticky prompts around it',
		category: 'Workshops',
		keywords: ['ideas', 'ideation', 'stickies', 'topic'],
		featured: true,
		build: async (doc) => (await import('./brainstorm')).buildBrainstorm(doc)
	},
	{
		id: 'meeting-notes',
		name: 'Meeting notes',
		description: 'Agenda, notes and action items, plus decisions',
		category: 'Notes',
		keywords: ['agenda', 'minutes', 'actions', 'document'],
		featured: true,
		build: async (doc) => (await import('./meetingNotes')).buildMeetingNotes(doc)
	}
];

/** A new board filled from a template, with its start-page thumbnail ready. */
export async function createBoardFromTemplate(t: Template): Promise<BoardMeta> {
	return (await import('./create')).createBoardFromTemplate(t);
}

/** Templates whose name, description, category or keywords contain every word of `query`. */
export function searchTemplates(
	query: string,
	category: TemplateCategory | null = null,
	list: readonly Template[] = templates
): Template[] {
	const words = query.toLowerCase().split(/\s+/).filter(Boolean);
	return list.filter((t) => {
		if (category && t.category !== category) return false;
		const hay = [t.name, t.description, t.category, ...t.keywords].join(' ').toLowerCase();
		return words.every((w) => hay.includes(w));
	});
}
