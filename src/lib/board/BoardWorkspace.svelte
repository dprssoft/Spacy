<script lang="ts">
	import { page } from '$app/state';
	import { generatePerfElements } from '$lib/dev/perfBoard';
	import { installTestHooks } from '$lib/dev/testHooks';
	import { createElements } from '$lib/model/ops';
	import type { OpenBoard } from '$lib/storage/boardDoc';
	import { BoardStore } from './boardStore.svelte';
	import ElementsLayer from './canvas/ElementsLayer.svelte';
	import Canvas from './canvas/Canvas.svelte';
	import { setBoard } from './context';
	import { BoardTitle } from './title.svelte';
	import TopBar from './TopBar.svelte';
	import { ViewportState } from './viewport.svelte';

	let { board }: { board: OpenBoard } = $props();

	// The board is fixed for this component's lifetime (the route re-creates it per id).
	// svelte-ignore state_referenced_locally
	const ctx = setBoard({
		id: board.id,
		doc: board.doc,
		undo: board.undo,
		viewport: new ViewportState(),
		store: new BoardStore(board.doc)
	});
	const title = new BoardTitle(ctx.id, ctx.doc);

	$effect(() => () => {
		title.destroy();
		ctx.viewport.destroy();
		ctx.store.destroy();
	});
	$effect(() => installTestHooks(ctx));
	$effect(() => {
		document.title = `${title.value || 'Board'} — SMTHNG`;
	});
</script>

<div class="flex h-dvh flex-col">
	<TopBar {title} />
	<main class="relative min-h-0 flex-1 overflow-hidden bg-canvas">
		<Canvas contentBounds={() => ctx.store.contentBounds()}>
			{#snippet world()}
				<ElementsLayer />
			{/snippet}
		</Canvas>
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
