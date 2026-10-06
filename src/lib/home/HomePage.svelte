<script lang="ts">
	import { page } from '$app/state';
	import { debounce } from '$lib/shared/debounce';
	import { getPref, setPref } from '$lib/shared/localPrefs';
	import ConfirmDialog from '$lib/shared/ui/ConfirmDialog.svelte';
	import * as boardsRepo from '$lib/storage/boardsRepo';
	import { requestPersistentStorage } from '$lib/storage/persist';
	import type { BoardSort } from '$lib/storage/types';
	import * as actions from './actions';
	import { BoardsQuery } from './boards.svelte';
	import BackupReminder from './BackupReminder.svelte';
	import BoardGrid from './BoardGrid.svelte';
	import DropZone from './DropZone.svelte';
	import GridToolbar from './GridToolbar.svelte';
	import HomeHeader from './HomeHeader.svelte';
	import { HomeUI, setHomeUI, type Layout } from './homeUI.svelte';
	import Sidebar from './Sidebar.svelte';
	import TemplatesRow from './TemplatesRow.svelte';
	import { handleLaunchFiles } from './fileActions';
	import { parseView } from './views';

	/** Featured template previews (SVG data URLs), drawn at build time. */
	let { templatePreviews }: { templatePreviews: Record<string, string> } = $props();

	const SORTS: BoardSort[] = ['opened', 'updated', 'created', 'title'];

	const ui = setHomeUI(new HomeUI());
	const query = new BoardsQuery();
	// This page is prerendered: it hydrates with the defaults (the build has no URL query and no
	// localStorage), then applies the view from the URL and the stored sort and layout.
	let hydrated = $state(false);
	const view = $derived(hydrated ? parseView(page.url.searchParams.get('view')) : 'recent');

	let search = $state('');
	let sort = $state<BoardSort>('opened');
	let layout = $state<Layout>('grid');
	$effect(() => {
		const storedSort = getPref<BoardSort>('home:sort', 'opened');
		sort = SORTS.includes(storedSort) ? storedSort : 'opened';
		layout = getPref<string>('home:layout', 'grid') === 'list' ? 'list' : 'grid';
		hydrated = true;
	});

	const applySearch = debounce((q: string) => (query.query = q), 150);

	$effect(() => {
		query.filter = view;
	});
	$effect(() => {
		query.sort = sort;
		if (hydrated) setPref('home:sort', sort);
	});
	$effect(() => {
		if (hydrated) setPref('home:layout', layout);
	});
	$effect(() => applySearch(search));
	$effect(() => query.start());
	$effect(() => {
		void requestPersistentStorage();
		// Housekeeping: the board storage code it needs only loads when something has expired.
		void boardsRepo
			.expiredTrash()
			.then(async (ids) => {
				if (ids.length > 0) await (await import('$lib/storage/boardLifecycle')).purgeExpiredTrash();
			})
			.catch((err) => console.error('Trash purge failed', err));
	});

	$effect(() => handleLaunchFiles());

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

<DropZone />
<div class="flex h-dvh flex-col">
	<HomeHeader bind:search />
	<div class="flex min-h-0 flex-1 flex-col md:flex-row">
		<Sidebar active={view} />
		<main class="min-h-0 flex-1 overflow-y-auto">
			<div class="mx-auto max-w-7xl space-y-8 p-4 md:p-8">
				<BackupReminder />
				{#if (view === 'recent' || view === 'all') && !query.query}
					<TemplatesRow previews={templatePreviews} />
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
