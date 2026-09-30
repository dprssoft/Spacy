import { getContext, setContext } from 'svelte';
import type * as Y from 'yjs';
import type { Point } from '$lib/model/types';
import type { BoardStore } from './boardStore.svelte';
import type { HistoryState } from './commands/history.svelte';
import type { TextEditing } from './editing';
import type { SelectionState } from './selection.svelte';
import type { HandleRegistry } from './tools/handles';
import type { ShortcutRegistry } from './tools/shortcuts';
import type { ToolManager } from './tools/toolManager.svelte';
import type { ViewportState } from './viewport.svelte';

/** Everything a board's components share. Later steps add the store, viewport, tools, … */
export interface BoardContext {
	id: string;
	doc: Y.Doc;
	undo: Y.UndoManager;
	viewport: ViewportState;
	store: BoardStore;
	selection: SelectionState;
	tools: ToolManager;
	handles: HandleRegistry;
	shortcuts: ShortcutRegistry;
	editing: TextEditing;
	history: HistoryState;
	/** Last pointer position over the canvas (world); not reactive. */
	pointer: Point | null;
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
