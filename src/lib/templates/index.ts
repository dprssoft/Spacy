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
		id: 'kanban',
		name: 'Kanban',
		description: 'To do, in progress and done, with starter cards',
		category: 'Planning',
		keywords: ['board', 'tasks', 'agile', 'scrum', 'todo', 'sprint'],
		featured: true,
		build: async (doc) => (await import('./kanban')).buildKanban(doc)
	},
	{
		id: 'retrospective',
		name: 'Retrospective',
		description: 'What went well, what to improve, and actions',
		category: 'Workshops',
		keywords: ['retro', 'sprint', 'review', 'feedback', 'agile'],
		featured: false,
		build: async (doc) => (await import('./retrospective')).buildRetrospective(doc)
	},
	{
		id: 'swot',
		name: 'SWOT analysis',
		description: 'Strengths, weaknesses, opportunities and threats',
		category: 'Strategy',
		keywords: ['analysis', 'strategy', 'matrix', 'planning'],
		featured: false,
		build: async (doc) => (await import('./swot')).buildSwot(doc)
	},
	{
		id: 'eisenhower',
		name: 'Eisenhower matrix',
		description: 'Sort tasks by urgency and importance',
		category: 'Planning',
		keywords: ['priorities', 'urgent', 'important', 'matrix', '2x2'],
		featured: false,
		build: async (doc) => (await import('./eisenhower')).buildEisenhower(doc)
	},
	{
		id: 'mind-map',
		name: 'Mind map',
		description: 'A main idea with branches and sub-ideas',
		category: 'Diagrams',
		keywords: ['mindmap', 'ideas', 'branches', 'tree'],
		featured: false,
		build: async (doc) => (await import('./mindMap')).buildMindMap(doc)
	},
	{
		id: 'timeline',
		name: 'Timeline',
		description: 'A roadmap by quarter with milestones',
		category: 'Planning',
		keywords: ['roadmap', 'quarters', 'milestones', 'schedule', 'plan'],
		featured: false,
		build: async (doc) => (await import('./timeline')).buildTimeline(doc)
	},
	{
		id: 'journey-map',
		name: 'User journey map',
		description: 'Stages against actions, thoughts, feelings and opportunities',
		category: 'Strategy',
		keywords: ['customer', 'ux', 'experience', 'research', 'journey'],
		featured: false,
		build: async (doc) => (await import('./journeyMap')).buildJourneyMap(doc)
	},
	{
		id: 'business-model-canvas',
		name: 'Business model canvas',
		description: 'The nine building blocks of a business model',
		category: 'Strategy',
		keywords: ['bmc', 'startup', 'business', 'model', 'lean'],
		featured: false,
		build: async (doc) => (await import('./businessModelCanvas')).buildBusinessModelCanvas(doc)
	},
	{
		id: 'weekly-planner',
		name: 'Weekly planner',
		description: 'Monday to Friday, plus notes for the week',
		category: 'Planning',
		keywords: ['week', 'calendar', 'days', 'schedule', 'plan'],
		featured: false,
		build: async (doc) => (await import('./weeklyPlanner')).buildWeeklyPlanner(doc)
	},
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
