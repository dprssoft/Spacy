// A lightweight BoardContext for unit tests (no DOM, no persistence). Not imported by app code.
import * as Y from 'yjs';
import { getElementsMap } from '$lib/model/doc';
import { LOCAL } from '$lib/model/origins';
import { BoardStore } from './boardStore.svelte';
import { HistoryState } from './commands/history.svelte';
import type { BoardContext } from './context';
import { installConnectorHooks } from './diagram/ops';
import { TextEditing } from './editing';
import { BoardPrefs } from './prefs.svelte';
import { PreviewState } from './preview.svelte';
import { SelectionState } from './selection.svelte';
import { ViewportState } from './viewport.svelte';

export function testCtx(id = 'board-1', doc = new Y.Doc()): BoardContext {
	installConnectorHooks();
	const undo = new Y.UndoManager(getElementsMap(doc), { trackedOrigins: new Set([LOCAL]) });
	const viewport = new ViewportState();
	viewport.size = { w: 1000, h: 800 };
	viewport.set({ x: 500, y: 400, zoom: 1 }); // world origin at the screen center
	const ctx = {
		id,
		doc,
		undo,
		viewport,
		store: new BoardStore(doc),
		selection: new SelectionState(),
		history: new HistoryState(undo),
		pointer: null,
		preview: new PreviewState(),
		prefs: new BoardPrefs(),
		tools: { setTool() {}, current: 'select' }
	} as unknown as BoardContext;
	ctx.editing = new TextEditing(ctx);
	return ctx;
}
