<script lang="ts">
	import { Popover } from 'bits-ui';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import X from '@lucide/svelte/icons/x';
	import { getBoard } from '../context';
	import WaystoneList from './WaystoneList.svelte';

	// The page's tabs (stored as waystones): ◀ "2 / 5 · Act II" ▶; the name opens the list. Always
	// docked in the status bar, so a first tab is one click away; floating over the board only
	// while presenting (the status bar is hidden).
	let { floating = false }: { floating?: boolean } = $props();

	const ctx = getBoard();
	const { waystones } = ctx;
	const route = $derived(waystones.route);
	const at = $derived(Math.min(waystones.current, route.length - 1));
	const here = $derived(at >= 0 ? route[at] : undefined);

	const button = $derived(
		`inline-flex shrink-0 items-center justify-center text-muted hover:bg-surface-2 hover:text-text disabled:opacity-40 pointer-coarse:size-11 ${floating ? 'size-8 rounded-full' : 'size-7 rounded-md hover:bg-surface'}`
	);
</script>

{#if route.length > 0 || !floating}
	<div
		class={floating
			? 'absolute bottom-3 left-1/2 z-20 flex w-max max-w-[calc(100%-16px)] -translate-x-1/2 items-center gap-0.5 rounded-full border border-border bg-surface p-1 shadow-lg'
			: 'flex min-w-0 shrink-0 items-center justify-center gap-0.5 self-center'}
		role="toolbar"
		aria-label="Tabs"
		data-interactive
		data-testid="waystone-bar"
	>
		{#if route.length > 0}<button
				type="button"
				class={button}
				aria-label="Previous tab"
				title="Previous tab (PageUp)"
				aria-keyshortcuts="PageUp"
				disabled={!waystones.wrap && at <= 0}
				onclick={() => waystones.step(-1)}><ChevronLeft class="size-4" aria-hidden="true" /></button
			>{/if}
		<Popover.Root bind:open={waystones.listOpen}>
			<Popover.Trigger
				class={floating
					? 'inline-flex h-8 max-w-64 min-w-0 items-center justify-center gap-1.5 rounded-full px-3 text-sm hover:bg-surface-2 pointer-coarse:h-11'
					: 'inline-flex h-7 max-w-56 min-w-0 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs hover:bg-surface max-sm:max-w-none pointer-coarse:h-11'}
				aria-label="Tabs list"
				title="All tabs"
				data-testid="waystone-current"
			>
				<MapPin class="size-3.5 shrink-0 text-muted" aria-hidden="true" />
				<span class="tabular-nums" data-testid="waystone-position"
					>{here
						? `${at + 1} / ${route.length}`
						: route.length > 0
							? `– / ${route.length}`
							: 'Tabs'}</span
				>
				{#if here}<span class="truncate text-muted" class:max-sm:hidden={!floating}
						>· {here.name}</span
					>{/if}
				<ChevronUp class="size-3 shrink-0 text-muted" aria-hidden="true" />
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
		{#if route.length > 0}<button
				type="button"
				class={button}
				aria-label="Next tab"
				title="Next tab (PageDown)"
				aria-keyshortcuts="PageDown"
				disabled={!waystones.wrap && at >= route.length - 1}
				onclick={() => waystones.step(1)}><ChevronRight class="size-4" aria-hidden="true" /></button
			>{/if}
		{#if waystones.presenting}
			<button
				type="button"
				class={button}
				aria-label="Stop presenting"
				title="Stop presenting (Esc)"
				onclick={() => waystones.stopPresenting()}><X class="size-4" aria-hidden="true" /></button
			>
		{/if}
	</div>
{/if}
