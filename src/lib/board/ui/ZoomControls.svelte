<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import { nextZoomStep, zoomAt } from '../engine/viewport';
	import type { ViewportState } from '../viewport.svelte';
	import type { Rect } from '$lib/model/types';
	import { getBoard } from '../context';
	import HelpMenu from './HelpMenu.svelte';
	import { fitRect } from '../engine/viewport';

	let {
		viewport,
		contentBounds
	}: {
		viewport: ViewportState;
		/** Bounds of everything on the board, for "Zoom to fit" (null = empty board). */
		contentBounds: () => Rect | null;
	} = $props();

	const percent = $derived(Math.round(viewport.zoom * 100));
	const { store, prefs } = getBoard();
	const frames = $derived(
		store.frameOrder.flatMap((id) => {
			const el = store.get(id);
			return el?.type === 'frame' ? [el] : [];
		})
	);

	function zoomTo(z: number) {
		viewport.animateTo(zoomAt(viewport.vp, viewport.center, z));
	}

	const button =
		'inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-40';
	const item =
		'flex h-8 cursor-default items-center justify-between gap-6 rounded-md px-2 text-sm outline-none select-none data-[highlighted]:bg-surface-2';
</script>

<div
	class="absolute right-3 bottom-3 z-20 flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5 shadow-md"
	data-interactive
>
	<button
		type="button"
		class={button}
		aria-label="Zoom out"
		disabled={viewport.zoom <= 0.1}
		onclick={() => zoomTo(nextZoomStep(viewport.zoom, -1))}
	>
		<Minus class="size-4" aria-hidden="true" />
	</button>
	<DropdownMenu.Root>
		<DropdownMenu.Trigger
			aria-label="Zoom options, current zoom {percent}%"
			class="h-8 min-w-14 rounded-md px-1.5 text-xs font-medium tabular-nums hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
		>
			<span data-testid="zoom-level">{percent}%</span>
		</DropdownMenu.Trigger>
		<DropdownMenu.Portal>
			<DropdownMenu.Content
				side="top"
				align="end"
				sideOffset={6}
				class="z-50 min-w-48 rounded-lg border border-border bg-surface p-1 shadow-lg"
			>
				<DropdownMenu.Item class={item} onSelect={() => viewport.fit(contentBounds())}>
					Zoom to fit <kbd class="text-xs text-muted">⇧1</kbd>
				</DropdownMenu.Item>
				<DropdownMenu.Separator class="my-1 h-px bg-border" />
				{#each [0.5, 1, 2] as z (z)}
					<DropdownMenu.Item class={item} onSelect={() => zoomTo(z)}>
						Zoom to {z * 100}%
						{#if z === 1}<kbd class="text-xs text-muted">⇧0</kbd>{/if}
					</DropdownMenu.Item>
				{/each}
				<DropdownMenu.Separator class="my-1 h-px bg-border" />
				<DropdownMenu.CheckboxItem
					class={item}
					checked={prefs.grid}
					onCheckedChange={(v) => prefs.setGrid(v)}
				>
					{#snippet children({ checked })}
						Show grid <span class="text-xs text-muted">{checked ? '✓' : ''}</span>
					{/snippet}
				</DropdownMenu.CheckboxItem>
				<DropdownMenu.CheckboxItem
					class={item}
					checked={prefs.snapToGrid}
					onCheckedChange={(v) => prefs.setSnapToGrid(v)}
				>
					{#snippet children({ checked })}
						Snap to grid <span class="text-xs text-muted">{checked ? '✓' : ''}</span>
					{/snippet}
				</DropdownMenu.CheckboxItem>
				{#if frames.length}
					<DropdownMenu.Separator class="my-1 h-px bg-border" />
					<DropdownMenu.Group>
						<DropdownMenu.GroupHeading class="px-2 pt-1 pb-0.5 text-xs font-medium text-muted"
							>Frames</DropdownMenu.GroupHeading
						>
						{#each frames as frame (frame.id)}
							<DropdownMenu.Item
								class={item}
								onSelect={() => viewport.animateTo(fitRect(frame, viewport.size, 64, 2))}
							>
								<span class="max-w-48 truncate">{frame.title}</span>
							</DropdownMenu.Item>
						{/each}
					</DropdownMenu.Group>
				{/if}
			</DropdownMenu.Content>
		</DropdownMenu.Portal>
	</DropdownMenu.Root>
	<button
		type="button"
		class={button}
		aria-label="Zoom in"
		disabled={viewport.zoom >= 4}
		onclick={() => zoomTo(nextZoomStep(viewport.zoom, 1))}
	>
		<Plus class="size-4" aria-hidden="true" />
	</button>
	<div class="mx-0.5 h-5 w-px bg-border" aria-hidden="true"></div>
	<HelpMenu class={button} />
</div>
