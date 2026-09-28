<script lang="ts">
	import type { OpenBoard } from '$lib/storage/boardDoc';
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
		viewport: new ViewportState()
	});
	const title = new BoardTitle(ctx.id, ctx.doc);

	$effect(() => () => {
		title.destroy();
		ctx.viewport.destroy();
	});
	$effect(() => {
		document.title = `${title.value || 'Board'} — SMTHNG`;
	});
</script>

<div class="flex h-dvh flex-col">
	<TopBar {title} />
	<main class="relative min-h-0 flex-1 overflow-hidden bg-canvas">
		<Canvas>
			{#snippet world()}
				<!-- Temporary origin marker (removed in step 10 when elements render). -->
				<div class="absolute -top-3 -left-3 size-6" aria-hidden="true" data-testid="origin">
					<div class="absolute top-1/2 left-0 h-px w-full bg-muted"></div>
					<div class="absolute top-0 left-1/2 h-full w-px bg-muted"></div>
				</div>
			{/snippet}
		</Canvas>
	</main>
</div>
