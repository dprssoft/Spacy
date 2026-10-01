<script lang="ts">
	import type { Component } from 'svelte';

	export interface SuggestionEntry {
		label: string;
		icon?: Component<{ class?: string }>;
	}

	let {
		entries,
		selected,
		rect,
		label,
		onpick
	}: {
		entries: SuggestionEntry[];
		selected: number;
		/** The caret's client rect; the list goes below it, or above near the bottom of the window. */
		rect: DOMRect | null;
		label: string;
		onpick(index: number): void;
	} = $props();

	let list = $state<HTMLDivElement>();
	let pos = $state({ x: -9999, y: -9999 });
	const GAP = 6;
	const MARGIN = 8;

	$effect(() => {
		void entries.length;
		if (!rect || !list) return;
		const w = list.offsetWidth;
		const h = list.offsetHeight;
		const below = rect.bottom + GAP;
		const y =
			below + h > window.innerHeight - MARGIN ? Math.max(MARGIN, rect.top - GAP - h) : below;
		const x = Math.min(Math.max(MARGIN, rect.left), window.innerWidth - w - MARGIN);
		pos = { x, y };
	});

	$effect(() => {
		list?.querySelector(`[data-index="${selected}"]`)?.scrollIntoView({ block: 'nearest' });
	});
</script>

<div
	bind:this={list}
	role="listbox"
	aria-label={label}
	data-interactive
	data-doc-popup
	class="fixed z-[70] max-h-72 w-60 overflow-y-auto rounded-lg border border-border bg-surface p-1 text-sm text-text shadow-lg"
	style:left="{pos.x}px"
	style:top="{pos.y}px"
>
	{#each entries as entry, i (i)}
		{@const Icon = entry.icon}
		<div
			role="option"
			tabindex="-1"
			aria-selected={i === selected}
			data-index={i}
			class="flex h-8 cursor-default items-center gap-2 rounded-md px-2 select-none aria-selected:bg-surface-2"
			onmousedown={(e) => {
				// Keep focus (and the caret) in the editor.
				e.preventDefault();
				onpick(i);
			}}
		>
			{#if Icon}<Icon class="size-4 shrink-0 text-muted" />{/if}
			<span class="truncate">{entry.label}</span>
		</div>
	{:else}
		<div class="px-2 py-1.5 text-muted">No results</div>
	{/each}
</div>
