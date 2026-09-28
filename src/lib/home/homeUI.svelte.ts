import { getContext, setContext } from 'svelte';
import type { BoardMeta } from '$lib/storage/types';

export type Layout = 'grid' | 'list';

/** Start-page UI state shared by the grid, cards and dialogs. */
export class HomeUI {
	renamingId = $state<string | null>(null);
	/** Boards awaiting "Delete forever" confirmation. */
	pendingDelete = $state<BoardMeta[] | null>(null);
}

const KEY = Symbol('home-ui');

export function setHomeUI(ui: HomeUI): HomeUI {
	return setContext(KEY, ui);
}

export function getHomeUI(): HomeUI {
	const ui = getContext<HomeUI | undefined>(KEY);
	if (!ui) throw new Error('HomeUI context missing');
	return ui;
}
