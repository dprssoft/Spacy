<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import * as boardsRepo from '$lib/storage/boardsRepo';

	// Placeholder until the board page (step 08): shows the title so navigation can be verified.
	const meta = $derived(boardsRepo.get(page.params.id ?? ''));
</script>

<svelte:head><title>Board — SMTHNG</title></svelte:head>

<main class="p-6">
	{#await meta then board}
		<h1 class="mb-1 text-lg font-medium">{board?.title ?? 'Board not found'}</h1>
	{/await}
	<p class="mb-4 text-sm text-muted">Board <span class="font-mono">{page.params.id}</span></p>
	<a href={resolve('/')} class="text-accent underline-offset-2 hover:underline">Back to boards</a>
</main>
