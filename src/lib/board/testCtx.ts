// A lightweight BoardContext for unit tests (no DOM, no persistence). Not imported by app code.
import * as Y from 'yjs';
import { ensureOutlineMap } from '$lib/model/outline';
import { createBoardUndo } from '$lib/storage/boardDoc';
import { BoardStore } from './boardStore.svelte';
import { HistoryState } from './commands/history.svelte';
import type { BoardContext } from './context';
import { installConnectorHooks } from './diagram/ops';
import { TextEditing } from './editing';
import { PlaybackState } from './media/playback.svelte';
import { PagesState } from './pages.svelte';
import { BoardWordStats } from './writing/boardStats.svelte';
import { OutlineState } from './writing/outlineState.svelte';
import { BacklinkIndex } from './writing/backlinks.svelte';
import { BoardPrefs } from './prefs.svelte';
import { PreviewState } from './preview.svelte';
import { SelectionState } from './selection.svelte';
import { SketchSettings } from './sketch/settings.svelte';
import { ViewportState } from './viewport.svelte';

export function testCtx(id = 'board-1', doc = new Y.Doc()): BoardContext {
	installConnectorHooks();
	ensureOutlineMap(doc);
	const undo = createBoardUndo(doc);
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
		playback: new PlaybackState(),
		sketch: new SketchSettings(),
		tools: { setTool() {}, current: 'select', tool: { onCancel() {} } }
	} as unknown as BoardContext;
	ctx.editing = new TextEditing(ctx);
	ctx.pages = new PagesState(ctx);
	ctx.words = new BoardWordStats(doc, ctx.store);
	ctx.outline = new OutlineState(ctx);
	ctx.backlinks = new BacklinkIndex(doc);
	return ctx;
}
