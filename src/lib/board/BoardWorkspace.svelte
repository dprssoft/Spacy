<script lang="ts">
	import { page } from '$app/state';
	import { generatePerfElements } from '$lib/dev/perfBoard';
	import { installTestHooks } from '$lib/dev/testHooks';
	import { createElements } from '$lib/model/ops';
	import type { OpenBoard } from '$lib/storage/boardDoc';
	import { BoardStore } from './boardStore.svelte';
	import ElementsLayer from './canvas/ElementsLayer.svelte';
	import Canvas from './canvas/Canvas.svelte';
	import { setBoard, type BoardContext } from './context';
	import { TextEditing } from './editing';
	import { SelectionState } from './selection.svelte';
	import SelectionOverlay from './canvas/SelectionOverlay.svelte';
	import { onCopyEvent, onPasteEvent } from './commands/clipboard';
	import { editShortcuts } from './commands/editShortcuts';
	import { HistoryState } from './commands/history.svelte';
	import CanvasContextMenu from './ui/CanvasContextMenu.svelte';
	import { toolShortcuts, viewShortcuts } from './tools/boardShortcuts';
	import { selectShortcuts } from './tools/selectShortcuts';
	import { HandleRegistry } from './tools/handles';
	import { isTypingTarget, ShortcutRegistry } from './tools/shortcuts';
	import { ToolManager } from './tools/toolManager.svelte';
	import Toolbar from './ui/Toolbar.svelte';
	import { BoardTitle } from './title.svelte';
	import TopBar from './TopBar.svelte';
	import { ViewportState } from './viewport.svelte';

	let { board }: { board: OpenBoard } = $props();

	// The board is fixed for this component's lifetime (the route re-creates it per id).
	// svelte-ignore state_referenced_locally
	const ctx = {
		id: board.id,
		doc: board.doc,
		undo: board.undo,
		viewport: new ViewportState(),
		store: new BoardStore(board.doc),
		selection: new SelectionState(),
		handles: new HandleRegistry(),
		shortcuts: new ShortcutRegistry(),
		history: new HistoryState(board.undo),
		pointer: null
	} as BoardContext;
	ctx.tools = new ToolManager(ctx);
	ctx.editing = new TextEditing(ctx);
	ctx.shortcuts.register([
		...toolShortcuts,
		...viewShortcuts,
		...selectShortcuts,
		...editShortcuts
	]);
	setBoard(ctx);
	const title = new BoardTitle(ctx.id, ctx.doc);

	$effect(() => () => {
		title.destroy();
		ctx.viewport.destroy();
		ctx.store.destroy();
		ctx.history.destroy();
	});
	$effect(() => installTestHooks(ctx));
	// Keep the selection valid when elements disappear (other tab, undo…).
	$effect(() => {
		void ctx.store.version;
		ctx.selection.prune((id) => ctx.store.elements.has(id));
	});

	/** Clipboard events belong to the board unless focus is in a text field or floating UI. */
	function boardOwnsClipboard(e: Event): boolean {
		const t = document.activeElement;
		if (isTypingTarget(t) || isTypingTarget(e.target)) return false;
		return !(t instanceof Element && t.closest('[role=menu],[role=dialog],[role=alertdialog]'));
	}

	function onCopy(e: ClipboardEvent) {
		if (boardOwnsClipboard(e)) onCopyEvent(ctx, e, false);
	}
	function onCut(e: ClipboardEvent) {
		if (boardOwnsClipboard(e)) onCopyEvent(ctx, e, true);
	}
	function onPaste(e: ClipboardEvent) {
		if (boardOwnsClipboard(e)) onPasteEvent(ctx, e);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.defaultPrevented || isTypingTarget(e.target)) return;
		// Keys typed into floating UI (menus, dialogs) belong to that UI.
		if (
			e.target instanceof Element &&
			e.target.closest('[role=menu],[role=dialog],[role=alertdialog]')
		)
			return;
		if (ctx.tools.tool.onKeyDown?.(e)) {
			e.preventDefault();
			return;
		}
		const shortcut = ctx.shortcuts.find(e, ctx);
		if (shortcut) {
			e.preventDefault();
			shortcut.run(ctx);
		}
	}
	$effect(() => {
		document.title = `${title.value || 'Board'} — SMTHNG`;
	});
</script>

<svelte:window onkeydown={onKeydown} />
<svelte:document oncopy={onCopy} oncut={onCut} onpaste={onPaste} />

<div class="flex h-dvh flex-col">
	<TopBar {title} />
	<main class="relative min-h-0 flex-1 overflow-hidden bg-canvas">
		<CanvasContextMenu>
			<Canvas contentBounds={() => ctx.store.contentBounds()}>
				{#snippet world()}
					<ElementsLayer />
				{/snippet}
				{#snippet overlay()}
					<SelectionOverlay />
				{/snippet}
			</Canvas>
		</CanvasContextMenu>
		<Toolbar />
		{#if import.meta.env.DEV && page.url.searchParams.get('debug') === 'perf'}
			<button
				type="button"
				class="absolute top-3 left-3 z-20 rounded-md bg-accent px-3 py-1.5 text-sm text-accent-contrast shadow"
				onclick={() =>
					createElements(ctx.doc, generatePerfElements(3000, Math.floor(Math.random() * 1e6)))}
			>
				Generate 3,000 elements
			</button>
		{/if}
	</main>
</div>
