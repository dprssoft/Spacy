<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { DropdownMenu } from 'bits-ui';
	import type { KanbanColumn } from '$lib/model/kanban';
	import { getBoard } from '../context';
	import { menuContent, menuItem } from '../ui/tabMenu';
	import { columnsOfBoard, moveCardTo } from './ops';

	let { cardId, column }: { cardId: string; column: KanbanColumn } = $props();

	const ctx = getBoard();
	let open = $state(false);
	// Only while the menu is open: the card's own render stays cheap.
	const columns = $derived(open ? columnsOfBoard(ctx, column) : []);
</script>

<DropdownMenu.Root bind:open>
	<DropdownMenu.Trigger
		class="pointer-events-auto inline-flex h-6 max-w-full items-center gap-1 self-start rounded-full bg-black/8 px-2 text-xs font-medium hover:bg-black/15"
		aria-label="Status: {column.title}. Change status"
		title="Change status"
		data-interactive
		data-testid="kanban-status"
		onpointerdown={(e: PointerEvent) => e.stopPropagation()}
	>
		<span class="truncate">{column.title}</span>
		<ChevronDown class="size-3 shrink-0" aria-hidden="true" />
	</DropdownMenu.Trigger>
	<DropdownMenu.Portal>
		<DropdownMenu.Content
			side="bottom"
			align="start"
			sideOffset={4}
			class={menuContent}
			data-interactive
		>
			{#each columns as c (c.id)}
				<DropdownMenu.Item class={menuItem} onSelect={() => moveCardTo(ctx, cardId, c.id)}>
					<Check class="size-4 {c.id === column.id ? '' : 'invisible'}" aria-hidden="true" />
					<span class="truncate">{c.title}</span>
				</DropdownMenu.Item>
			{/each}
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>
