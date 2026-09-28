<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { BoardMeta } from '$lib/storage/types';
	import * as actions from './actions';
	import { getHomeUI } from './homeUI.svelte';

	let { board, tabindex = 0 }: { board: BoardMeta; tabindex?: number } = $props();

	const ui = getHomeUI();
	// Rename focuses an input; the menu must not steal focus back to its trigger when it closes.
	let renaming = false;
	const trashed = $derived(board.deletedAt !== null);
	const href = $derived(resolve('/board/[id]', { id: board.id }));

	const item =
		'flex h-8 cursor-default items-center rounded-md px-2 text-sm outline-none select-none data-[disabled]:opacity-40 data-[highlighted]:bg-surface-2';
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger
		{tabindex}
		aria-label="Board actions"
		class="inline-flex size-7 items-center justify-center rounded-md bg-surface/90 text-muted shadow-sm backdrop-blur transition hover:text-text focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none data-[state=open]:text-text"
	>
		<Ellipsis class="size-4" aria-hidden="true" />
	</DropdownMenu.Trigger>
	<DropdownMenu.Portal>
		<DropdownMenu.Content
			align="end"
			sideOffset={4}
			onCloseAutoFocus={(e) => {
				if (renaming) e.preventDefault();
				renaming = false;
			}}
			class="z-50 min-w-44 rounded-lg border border-border bg-surface p-1 shadow-lg"
		>
			{#if trashed}
				<DropdownMenu.Item class={item} onSelect={() => actions.restore(board)}
					>Restore</DropdownMenu.Item
				>
				<DropdownMenu.Item class="{item} text-danger" onSelect={() => (ui.pendingDelete = [board])}>
					Delete forever
				</DropdownMenu.Item>
			{:else}
				<DropdownMenu.Item class={item} onSelect={() => goto(href)}>Open</DropdownMenu.Item>
				<DropdownMenu.Item class={item} onSelect={() => actions.openInNewTab(href)}>
					Open in new tab
				</DropdownMenu.Item>
				<DropdownMenu.Item
					class={item}
					onSelect={() => {
						renaming = true;
						ui.renamingId = board.id;
					}}
				>
					Rename
				</DropdownMenu.Item>
				<DropdownMenu.Item class={item} onSelect={() => actions.duplicate(board)}>
					Duplicate
				</DropdownMenu.Item>
				<DropdownMenu.Item class={item} disabled title="Coming soon">Export</DropdownMenu.Item>
				<DropdownMenu.Separator class="my-1 h-px bg-border" />
				<DropdownMenu.Item class="{item} text-danger" onSelect={() => actions.moveToTrash(board)}>
					Move to trash
				</DropdownMenu.Item>
			{/if}
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>
