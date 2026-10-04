<script lang="ts">
	import { Popover } from 'bits-ui';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import X from '@lucide/svelte/icons/x';
	import { fullscreen } from '$lib/shared/fullscreen.svelte';
	import { getBoard } from '../context';
	import WaystoneList from './WaystoneList.svelte';

	// The route of the page's waystones: ◀ "2 / 5 · Act II" ▶; the name opens the list.
	const ctx = getBoard();
	const { waystones } = ctx;
	const route = $derived(waystones.route);
	const at = $derived(Math.min(waystones.current, route.length - 1));
	const here = $derived(at >= 0 ? route[at] : undefined);

	// Leaving full screen (Escape, the browser's own controls) stops presenting.
	let wasFullscreen = false;
	$effect(() => {
		const active = fullscreen.active;
		if (wasFullscreen && !active && waystones.presenting) waystones.presenting = false;
		wasFullscreen = active;
	});
	// Presenting ends with its route.
	$effect(() => {
		if (waystones.presenting && route.length === 0) waystones.stopPresenting();
	});

	function onkeydown(e: KeyboardEvent) {
		// Without full screen (not allowed here), Escape is the way out.
		if (e.key === 'Escape' && waystones.presenting) {
			e.preventDefault();
			waystones.stopPresenting();
		}
	}

	// Another page, another route.
	$effect(() => {
		void ctx.pages.current;
		waystones.reset();
	});

	const button =
		'inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-text disabled:opacity-40 pointer-coarse:size-11';
</script>

<svelte:window {onkeydown} />

{#if route.length > 0}
	<div
		class="absolute bottom-3 left-1/2 z-20 flex w-max max-w-[calc(100%-16px)] -translate-x-1/2 items-center gap-0.5 rounded-full border border-border bg-surface p-1 shadow-lg"
		role="toolbar"
		aria-label="Waystones"
		data-interactive
		data-testid="waystone-bar"
	>
		<button
			type="button"
			class={button}
			aria-label="Previous waystone"
			aria-keyshortcuts="PageUp"
			disabled={!waystones.wrap && at <= 0}
			onclick={() => waystones.step(-1)}><ChevronLeft class="size-4" aria-hidden="true" /></button
		>
		<Popover.Root bind:open={waystones.listOpen}>
			<Popover.Trigger
				class="inline-flex h-8 max-w-64 min-w-0 items-center justify-center gap-1.5 rounded-full px-3 text-sm hover:bg-surface-2 pointer-coarse:h-11"
				aria-label="Waystones list"
				data-testid="waystone-current"
			>
				<MapPin class="size-3.5 shrink-0 text-muted" aria-hidden="true" />
				<span class="tabular-nums" data-testid="waystone-position"
					>{here ? `${at + 1} / ${route.length}` : `– / ${route.length}`}</span
				>
				{#if here}<span class="truncate text-muted">· {here.name}</span>{/if}
			</Popover.Trigger>
			<Popover.Portal>
				<Popover.Content
					side="top"
					sideOffset={8}
					data-interactive
					class="z-50 w-80 max-w-[calc(100vw-16px)] rounded-xl border border-border bg-surface p-2 text-text shadow-lg"
				>
					<WaystoneList />
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
		<button
			type="button"
			class={button}
			aria-label="Next waystone"
			aria-keyshortcuts="PageDown"
			disabled={!waystones.wrap && at >= route.length - 1}
			onclick={() => waystones.step(1)}><ChevronRight class="size-4" aria-hidden="true" /></button
		>
		{#if waystones.presenting}
			<button
				type="button"
				class={button}
				aria-label="Stop presenting"
				onclick={() => waystones.stopPresenting()}><X class="size-4" aria-hidden="true" /></button
			>
		{/if}
	</div>
{/if}
