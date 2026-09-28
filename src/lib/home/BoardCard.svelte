<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { relativeTime } from '$lib/shared/relativeTime';
	import type { BoardMeta } from '$lib/storage/types';
	import { placeholderGradient } from './placeholderGradient';

	let {
		board,
		now,
		actions
	}: {
		board: BoardMeta;
		/** Current time, ticking on the page so "Edited …" stays fresh. */
		now: number;
		/** Top-right controls on the thumbnail (star, menu — step 07). */
		actions?: Snippet;
	} = $props();

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
</script>

<article
	class="group relative overflow-hidden rounded-xl border border-border bg-surface transition focus-within:ring-2 focus-within:ring-accent hover:-translate-y-0.5 hover:shadow-md"
>
	<a
		href={resolve('/board/[id]', { id: board.id })}
		class="block focus-visible:outline-none"
		aria-label="Open {board.title}"
	>
		<div class="aspect-[16/10] border-b border-border bg-surface-2">
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
		<div class="p-3">
			<h3 class="truncate text-sm font-medium" title={board.title}>{board.title}</h3>
			<p class="mt-0.5 text-xs text-muted">Edited {relativeTime(board.updatedAt, now)}</p>
		</div>
	</a>
	{#if actions}
		<div class="absolute top-2 right-2 flex gap-1">{@render actions()}</div>
	{/if}
</article>
