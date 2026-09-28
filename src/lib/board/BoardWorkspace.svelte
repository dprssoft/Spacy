<script lang="ts">
	import type { OpenBoard } from '$lib/storage/boardDoc';
	import { setBoard } from './context';
	import { BoardTitle } from './title.svelte';
	import TopBar from './TopBar.svelte';

	let { board }: { board: OpenBoard } = $props();

	// The board is fixed for this component's lifetime (the route re-creates it per id).
	// svelte-ignore state_referenced_locally
	const ctx = setBoard({ id: board.id, doc: board.doc, undo: board.undo });
	const title = new BoardTitle(ctx.id, ctx.doc);

	$effect(() => () => title.destroy());
	$effect(() => {
		document.title = `${title.value || 'Board'} — SMTHNG`;
	});
</script>

<div class="flex h-dvh flex-col">
	<TopBar {title} />
	<main class="relative flex-1 overflow-hidden bg-canvas" aria-label="Board canvas"></main>
</div>
