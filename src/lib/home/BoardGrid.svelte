<script lang="ts">
	import Clock from '@lucide/svelte/icons/clock';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import Search from '@lucide/svelte/icons/search';
	import Star from '@lucide/svelte/icons/star';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import type { BoardFilter, BoardMeta } from '$lib/storage/types';
	import * as actions from './actions';
	import BoardCard from './BoardCard.svelte';
	import EmptyState from './EmptyState.svelte';
	import { gridColumns, nextIndex } from './gridNav';
	import { getHomeUI, type Layout } from './homeUI.svelte';

	let {
		view,
		boards,
		loading,
		now,
		layout,
		query
	}: {
		view: BoardFilter;
		boards: BoardMeta[];
		loading: boolean;
		now: number;
		layout: Layout;
		query: string;
	} = $props();

	const ui = getHomeUI();

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

	// Roving tabindex: the grid is one tab stop; arrow keys move between cards.
	let activeIndex = $state(0);
	let list = $state<HTMLUListElement>();
	const active = $derived(Math.min(activeIndex, Math.max(0, boards.length - 1)));

	function focusCard(index: number) {
		activeIndex = index;
		list?.querySelectorAll<HTMLElement>('[data-card-link]')[index]?.focus();
	}

	function onkeydown(e: KeyboardEvent) {
		const target = e.target as HTMLElement;
		const cards = [...(list?.querySelectorAll<HTMLElement>('[data-board-id]') ?? [])];
		const index = cards.findIndex((c) => c.contains(target));
		const board = boards[index];
		if (index < 0 || !board || target.closest('input')) return;

		if (target.matches('[data-card-link]')) {
			const cols = layout === 'list' || !list ? 1 : gridColumns(list);
			const next = nextIndex(index, e.key, cols, boards.length);
			if (next !== index) {
				e.preventDefault();
				focusCard(next);
				return;
			}
		}
		if (e.key === 'F2' && !board.deletedAt) {
			e.preventDefault();
			ui.renamingId = board.id;
		} else if (e.key === 'Delete') {
			e.preventDefault();
			if (board.deletedAt) ui.pendingDelete = [board];
			else void actions.moveToTrash(board);
		}
	}
</script>

<section aria-labelledby="board-grid-title" aria-busy={loading}>
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
		{#if query.trim()}
			<EmptyState
				icon={Search}
				title="No boards match “{query.trim()}”"
				text="Try a different search."
			/>
		{:else}
			<EmptyState {...empty[view]} />
		{/if}
	{:else}
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<ul
			bind:this={list}
			{onkeydown}
			class={layout === 'grid'
				? 'grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4'
				: 'flex flex-col gap-2'}
		>
			{#each boards as board, i (board.id)}
				<li onfocusin={() => (activeIndex = i)}>
					<BoardCard {board} {now} {layout} active={i === active} />
				</li>
			{/each}
		</ul>
	{/if}
</section>
