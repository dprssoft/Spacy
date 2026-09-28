import type { BoardFilter } from '$lib/storage/types';

export const VIEWS: readonly { id: BoardFilter; label: string; title: string }[] = [
	{ id: 'recent', label: 'Recent', title: 'Recent' },
	{ id: 'starred', label: 'Starred', title: 'Starred' },
	{ id: 'all', label: 'All boards', title: 'All boards' },
	{ id: 'trash', label: 'Trash', title: 'Trash' }
];

export function parseView(value: string | null): BoardFilter {
	return VIEWS.find((v) => v.id === value)?.id ?? 'recent';
}

export interface TemplateCardData {
	id: string;
	name: string;
	description: string;
}
