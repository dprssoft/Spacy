<script lang="ts">
	import { page } from '$app/state';
	import { debounce } from '$lib/shared/debounce';
	import { getPref, setPref } from '$lib/shared/localPrefs';
	import ConfirmDialog from '$lib/shared/ui/ConfirmDialog.svelte';
	import { purgeExpiredTrash } from '$lib/storage/boardLifecycle';
	import { requestPersistentStorage } from '$lib/storage/persist';
	import type { BoardSort } from '$lib/storage/types';
	import * as actions from './actions';
	import { BoardsQuery } from './boards.svelte';
	import BoardGrid from './BoardGrid.svelte';
	import GridToolbar from './GridToolbar.svelte';
	import HomeHeader from './HomeHeader.svelte';
	import { HomeUI, setHomeUI, type Layout } from './homeUI.svelte';
	import Sidebar from './Sidebar.svelte';
	import TemplatesRow from './TemplatesRow.svelte';
	import { parseView } from './views';

	const SORTS: BoardSort[] = ['opened', 'updated', 'created', 'title'];

	const ui = setHomeUI(new HomeUI());
	const query = new BoardsQuery();
	const view = $derived(parseView(page.url.searchParams.get('view')));

	let search = $state('');
	const storedSort = getPref<BoardSort>('home:sort', 'opened');
	let sort = $state<BoardSort>(SORTS.includes(storedSort) ? storedSort : 'opened');
	let layout = $state<Layout>(getPref<string>('home:layout', 'grid') === 'list' ? 'list' : 'grid');

	const applySearch = debounce((q: string) => (query.query = q), 150);

	$effect(() => {
		query.filter = view;
	});
	$effect(() => {
		query.sort = sort;
		setPref('home:sort', sort);
	});
	$effect(() => setPref('home:layout', layout));
	$effect(() => applySearch(search));
	$effect(() => query.start());
	$effect(() => {
		void requestPersistentStorage();
		void purgeExpiredTrash().catch((err) => console.error('Trash purge failed', err));
	});

	// Keeps "Edited …" labels fresh while the page stays open.
	let now = $state(Date.now());
	$effect(() => {
		const timer = setInterval(() => (now = Date.now()), 30_000);
		return () => clearInterval(timer);
	});

	const deleting = $derived(ui.pendingDelete ?? []);
	const deleteTitle = $derived(
		deleting.length === 1
			? `Delete “${deleting[0]?.title}” forever?`
			: `Delete ${deleting.length} boards forever?`
	);
</script>

<div class="flex h-dvh flex-col">
	<HomeHeader bind:search />
	<div class="flex min-h-0 flex-1 flex-col md:flex-row">
		<Sidebar active={view} />
		<main class="min-h-0 flex-1 overflow-y-auto">
			<div class="mx-auto max-w-7xl space-y-8 p-4 md:p-8">
				{#if (view === 'recent' || view === 'all') && !query.query}
					<TemplatesRow />
				{/if}
				<div>
					<GridToolbar
						{view}
						bind:sort
						bind:layout
						onEmptyTrash={view === 'trash' && query.items.length > 0 && !query.query
							? () => (ui.pendingDelete = [...query.items])
							: undefined}
					/>
					<BoardGrid
						{view}
						{layout}
						boards={query.items}
						loading={query.loading}
						query={query.query}
						{now}
					/>
				</div>
			</div>
		</main>
	</div>
</div>

<ConfirmDialog
	bind:open={
		() => ui.pendingDelete !== null,
		(v) => {
			if (!v) ui.pendingDelete = null;
		}
	}
	title={deleteTitle}
	description="This can’t be undone."
	confirmLabel="Delete forever"
	danger
	onConfirm={() => {
		const boards = deleting;
		ui.pendingDelete = null;
		void actions.deleteForever(boards);
	}}
/>
