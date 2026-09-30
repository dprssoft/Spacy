<script lang="ts">
	import { ContextMenu } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import { copyToClipboard, pasteFromClipboard } from '../commands/clipboard';
	import {
		canGroup,
		canUngroup,
		deleteSelection,
		duplicateSelection,
		groupSelection,
		reorderSelection,
		selectedElements,
		toggleLock,
		ungroupSelection
	} from '../commands/edit';
	import { getBoard } from '../context';
	import { formatKeys } from '../tools/formatKeys';

	let { children }: { children: Snippet } = $props();

	const ctx = getBoard();

	// Recomputed each time the menu opens (selection is updated by the right-click first).
	let open = $state(false);
	const hasSelection = $derived(open && ctx.selection.size > 0);
	const allLocked = $derived(open && selectedElements(ctx).every((el) => el.locked));

	const item =
		'flex h-8 cursor-default items-center justify-between gap-8 rounded-md px-2 text-sm outline-none select-none data-[disabled]:opacity-40 data-[highlighted]:bg-surface-2';
	const sep = 'my-1 h-px bg-border';
</script>

{#snippet entry(label: string, keys: string | null, run: () => void, disabled = false)}
	<ContextMenu.Item class={item} {disabled} onSelect={run}>
		<span>{label}</span>
		{#if keys}<kbd class="font-sans text-xs text-muted">{formatKeys(keys)}</kbd>{/if}
	</ContextMenu.Item>
{/snippet}

<ContextMenu.Root bind:open>
	<ContextMenu.Trigger class="block h-full w-full">
		{@render children()}
	</ContextMenu.Trigger>
	<ContextMenu.Portal>
		<ContextMenu.Content
			class="z-50 min-w-56 rounded-lg border border-border bg-surface p-1 shadow-lg"
			data-interactive
		>
			{#if hasSelection}
				{@render entry('Cut', 'Mod+X', () => copyToClipboard(ctx, true))}
				{@render entry('Copy', 'Mod+C', () => copyToClipboard(ctx))}
				{@render entry('Paste', 'Mod+V', () => pasteFromClipboard(ctx))}
				{@render entry('Duplicate', 'Mod+D', () => duplicateSelection(ctx))}
				{@render entry('Delete', 'Delete', () => deleteSelection(ctx), allLocked)}
				<ContextMenu.Separator class={sep} />
				{@render entry('Bring to front', 'Mod+]', () => reorderSelection(ctx, 'front'))}
				{@render entry('Bring forward', ']', () => reorderSelection(ctx, 'forward'))}
				{@render entry('Send backward', '[', () => reorderSelection(ctx, 'backward'))}
				{@render entry('Send to back', 'Mod+[', () => reorderSelection(ctx, 'back'))}
				<ContextMenu.Separator class={sep} />
				{#if canUngroup(ctx)}
					{@render entry('Ungroup', 'Mod+Shift+G', () => ungroupSelection(ctx))}
				{/if}
				{#if canGroup(ctx)}
					{@render entry('Group', 'Mod+G', () => groupSelection(ctx))}
				{/if}
				{@render entry(allLocked ? 'Unlock' : 'Lock', 'Mod+Shift+L', () => toggleLock(ctx))}
			{:else}
				{@render entry('Paste', 'Mod+V', () => pasteFromClipboard(ctx))}
				{@render entry('Select all', 'Mod+A', () =>
					ctx.selection.set(
						[...ctx.store.elements.values()].filter((el) => !el.locked).map((el) => el.id)
					)
				)}
				{@render entry('Zoom to fit', 'Shift+1', () => ctx.viewport.fit(ctx.store.contentBounds()))}
			{/if}
		</ContextMenu.Content>
	</ContextMenu.Portal>
</ContextMenu.Root>
