<script lang="ts">
	import Star from '@lucide/svelte/icons/star';
	import { toast } from 'svelte-sonner';
	import { resolve } from '$app/paths';
	import { relativeTime } from '$lib/shared/relativeTime';
	import InlineEditable from '$lib/shared/ui/InlineEditable.svelte';
	import type { BoardMeta } from '$lib/storage/types';
	import * as actions from './actions';
	import BoardCardMenu from './BoardCardMenu.svelte';
	import { getHomeUI, type Layout } from './homeUI.svelte';
	import { placeholderGradient } from './placeholderGradient';

	let {
		board,
		now,
		layout = 'grid',
		active = false
	}: {
		board: BoardMeta;
		/** Current time, ticking on the page so "Edited …" stays fresh. */
		now: number;
		layout?: Layout;
		/** Roving-tabindex focus target within the grid. */
		active?: boolean;
	} = $props();

	const ui = getHomeUI();
	const trashed = $derived(board.deletedAt !== null);
	const tab = $derived(active ? 0 : -1);
	const grid = $derived(layout === 'grid');

	let thumbUrl = $state<string | null>(null);
	$effect(() => {
		const blob = board.thumbnail;
		if (!blob) {
			thumbUrl = null;
			return;
		}
		const url = URL.createObjectURL(blob);
		thumbUrl = url;
		return () => URL.revokeObjectURL(url);
	});

	const hitArea = 'absolute inset-0 z-0 rounded-xl focus-visible:outline-none';
	const onHover = 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100';
</script>

<!-- One stretched link (or button, in trash) covers the card; controls sit above it (z-10). -->
<article
	data-board-id={board.id}
	class={[
		'group relative overflow-hidden rounded-xl border border-border bg-surface transition focus-within:ring-2 focus-within:ring-accent hover:shadow-md',
		grid ? 'hover:-translate-y-0.5' : 'flex items-center gap-4 p-2 pr-3'
	]}
>
	{#if trashed}
		<button
			type="button"
			data-card-link
			tabindex={tab}
			class={hitArea}
			aria-label="{board.title} (in trash)"
			onclick={() => toast('Restore the board to open it')}
		></button>
	{:else}
		<a
			href={resolve('/board/[id]', { id: board.id })}
			data-card-link
			tabindex={tab}
			class={hitArea}
			aria-label="Open {board.title}"
		></a>
	{/if}

	<div
		class={[
			'pointer-events-none shrink-0 overflow-hidden bg-surface-2',
			grid ? 'aspect-[16/10] border-b border-border' : 'h-10 w-16 rounded-md border border-border'
		]}
	>
		{#if thumbUrl}
			<img src={thumbUrl} alt="" class="size-full object-cover" draggable="false" />
		{:else}
			<div
				class="size-full dark:opacity-75"
				style:background={placeholderGradient(board.id)}
				aria-hidden="true"
			></div>
		{/if}
	</div>

	<div class={['pointer-events-none min-w-0', grid ? 'p-3' : 'flex flex-1 items-center gap-4']}>
		{#if ui.renamingId === board.id}
			<div class={['pointer-events-auto relative z-10', !grid && 'flex-1']}>
				<InlineEditable
					value={board.title}
					ariaLabel="Board title"
					inputClass="text-sm font-medium"
					bind:editing={
						() => ui.renamingId === board.id,
						(v) => {
							if (!v) ui.renamingId = null;
						}
					}
					onCommit={(t) => actions.rename(board, t)}
				/>
			</div>
		{:else}
			<h3 class={['truncate text-sm font-medium', !grid && 'flex-1']} title={board.title}>
				{board.title}
			</h3>
		{/if}
		<p class="mt-0.5 shrink-0 text-xs text-muted">
			{board.deletedAt !== null
				? `Deleted ${relativeTime(board.deletedAt, now)}`
				: `Edited ${relativeTime(board.updatedAt, now)}`}
		</p>
		{#if !grid}
			<p class="hidden w-36 shrink-0 text-xs text-muted lg:block">
				Created {new Date(board.createdAt).toLocaleDateString()}
			</p>
		{/if}
	</div>

	<div class={['z-10 flex gap-1', grid ? 'absolute top-2 right-2' : 'relative shrink-0']}>
		{#if !trashed}
			<button
				type="button"
				tabindex={tab}
				aria-label={board.starred ? 'Unstar board' : 'Star board'}
				title={board.starred ? 'Unstar' : 'Star'}
				aria-pressed={board.starred}
				onclick={() => actions.setStarred(board, !board.starred)}
				class={[
					'inline-flex size-7 items-center justify-center rounded-md bg-surface/90 shadow-sm backdrop-blur transition focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
					board.starred ? 'text-amber-500' : ['text-muted hover:text-text', onHover]
				]}
			>
				<Star class="size-4" fill={board.starred ? 'currentColor' : 'none'} aria-hidden="true" />
			</button>
		{/if}
		<div class={onHover}>
			<BoardCardMenu {board} tabindex={tab} />
		</div>
	</div>
</article>
