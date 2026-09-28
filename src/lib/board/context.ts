import { getContext, setContext } from 'svelte';
import type * as Y from 'yjs';
import type { BoardStore } from './boardStore.svelte';
import type { ViewportState } from './viewport.svelte';

/** Everything a board's components share. Later steps add the store, viewport, tools, … */
export interface BoardContext {
	id: string;
	doc: Y.Doc;
	undo: Y.UndoManager;
	viewport: ViewportState;
	store: BoardStore;
}

const KEY = Symbol('board');

export function setBoard(ctx: BoardContext): BoardContext {
	return setContext(KEY, ctx);
}

export function getBoard(): BoardContext {
	const ctx = getContext<BoardContext | undefined>(KEY);
	if (!ctx) throw new Error('Board context missing: use inside BoardWorkspace');
	return ctx;
}
