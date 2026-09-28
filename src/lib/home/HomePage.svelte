<script lang="ts">
	import { page } from '$app/state';
	import { requestPersistentStorage } from '$lib/storage/persist';
	import { BoardsQuery } from './boards.svelte';
	import BoardGrid from './BoardGrid.svelte';
	import HomeHeader from './HomeHeader.svelte';
	import Sidebar from './Sidebar.svelte';
	import TemplatesRow from './TemplatesRow.svelte';
	import { parseView } from './views';

	const query = new BoardsQuery();
	const view = $derived(parseView(page.url.searchParams.get('view')));

	$effect(() => {
		query.filter = view;
	});
	$effect(() => query.start());
	$effect(() => {
		void requestPersistentStorage();
	});

	// Keeps "Edited …" labels fresh while the page stays open.
	let now = $state(Date.now());
	$effect(() => {
		const timer = setInterval(() => (now = Date.now()), 30_000);
		return () => clearInterval(timer);
	});
</script>

<div class="flex h-dvh flex-col">
	<HomeHeader />
	<div class="flex min-h-0 flex-1 flex-col md:flex-row">
		<Sidebar active={view} />
		<main class="min-h-0 flex-1 overflow-y-auto">
			<div class="mx-auto max-w-7xl space-y-8 p-4 md:p-8">
				{#if view === 'recent' || view === 'all'}
					<TemplatesRow />
				{/if}
				<BoardGrid {view} boards={query.items} loading={query.loading} {now} />
			</div>
		</main>
	</div>
</div>
