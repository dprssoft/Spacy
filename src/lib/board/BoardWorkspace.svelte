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
	import { toolShortcuts, viewShortcuts } from './tools/boardShortcuts';
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
		shortcuts: new ShortcutRegistry()
	} as BoardContext;
	ctx.tools = new ToolManager(ctx);
	ctx.editing = new TextEditing(ctx);
	ctx.shortcuts.register([...toolShortcuts, ...viewShortcuts]);
	setBoard(ctx);
	const title = new BoardTitle(ctx.id, ctx.doc);

	$effect(() => () => {
		title.destroy();
		ctx.viewport.destroy();
		ctx.store.destroy();
	});
	$effect(() => installTestHooks(ctx));
	// Keep the selection valid when elements disappear (other tab, undo…).
	$effect(() => {
		void ctx.store.version;
		ctx.selection.prune((id) => ctx.store.elements.has(id));
	});

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

<div class="flex h-dvh flex-col">
	<TopBar {title} />
	<main class="relative min-h-0 flex-1 overflow-hidden bg-canvas">
		<Canvas contentBounds={() => ctx.store.contentBounds()}>
			{#snippet world()}
				<ElementsLayer />
			{/snippet}
		</Canvas>
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
