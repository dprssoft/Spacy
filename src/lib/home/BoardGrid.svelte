<script lang="ts">
	import Clock from '@lucide/svelte/icons/clock';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import Star from '@lucide/svelte/icons/star';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import type { BoardFilter, BoardMeta } from '$lib/storage/types';
	import BoardCard from './BoardCard.svelte';
	import EmptyState from './EmptyState.svelte';
	import { VIEWS } from './views';

	let {
		view,
		boards,
		loading,
		now
	}: { view: BoardFilter; boards: BoardMeta[]; loading: boolean; now: number } = $props();

	const title = $derived(VIEWS.find((v) => v.id === view)?.title ?? '');

	const empty = {
		recent: {
			icon: Clock,
			title: 'No boards yet',
			text: 'Create your first board to get started.'
		},
		all: {
			icon: LayoutGrid,
			title: 'No boards yet',
			text: 'Create your first board to get started.'
		},
		starred: { icon: Star, title: 'No starred boards', text: 'Star a board to pin it here.' },
		trash: { icon: Trash2, title: 'Trash is empty', text: 'Deleted boards stay here for 30 days.' }
	} satisfies Record<BoardFilter, unknown>;
</script>

<section aria-labelledby="board-grid-title" aria-busy={loading}>
	<h2 id="board-grid-title" class="mb-3 text-sm font-semibold text-muted">{title}</h2>

	{#if loading}
		<div class="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4" aria-hidden="true">
			{#each { length: 8 }, i (i)}
				<div class="overflow-hidden rounded-xl border border-border bg-surface">
					<div class="aspect-[16/10] animate-pulse bg-surface-2"></div>
					<div class="space-y-2 p-3">
						<div class="h-3.5 w-2/3 animate-pulse rounded bg-surface-2"></div>
						<div class="h-3 w-1/3 animate-pulse rounded bg-surface-2"></div>
					</div>
				</div>
			{/each}
		</div>
	{:else if boards.length === 0}
		<EmptyState {...empty[view]} />
	{:else}
		<ul class="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
			{#each boards as board (board.id)}
				<li><BoardCard {board} {now} /></li>
			{/each}
		</ul>
	{/if}
</section>
