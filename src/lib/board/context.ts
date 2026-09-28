import { getContext, setContext } from 'svelte';
import type * as Y from 'yjs';

/** Everything a board's components share. Later steps add the store, viewport, tools, … */
export interface BoardContext {
	id: string;
	doc: Y.Doc;
	undo: Y.UndoManager;
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
