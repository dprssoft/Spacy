<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import TableIcon from '@lucide/svelte/icons/table';
	import { button } from '../ui/ribbon';
	import type { Editor } from './editorFactory';
	import { hasHeaderRow, insertTable, TABLE_ACTIONS } from './tableCommands';

	// The ribbon's table control: insert a table, or edit the one at the caret.
	let {
		editor,
		inTable,
		canDelete = true,
		menu,
		menuItem,
		refocus
	}: {
		editor: Editor;
		/** The caret is in a table (read by the ribbon on every transaction). */
		inTable: boolean;
		/** False for a table element: it is always exactly one table. */
		canDelete?: boolean;
		menu: string;
		menuItem: string;
		refocus(e: Event): void;
	} = $props();

	let header = $state(false);
	// Read when the menu opens: merging needs several selected cells, splitting a merged one.
	let enabled = $state<Record<string, boolean>>({});
	function onOpen() {
		header = hasHeaderRow(editor);
		enabled = Object.fromEntries(TABLE_ACTIONS.map((a) => [a.id, a.can?.(editor) ?? true]));
	}
</script>

{#if inTable}
	<DropdownMenu.Root onOpenChange={(open) => open && onOpen()}>
		<DropdownMenu.Trigger
			class="{button} w-auto gap-0.5 px-1.5"
			aria-label="Table"
			title="Table"
			data-doc-format="table"
		>
			<TableIcon class="size-[18px]" aria-hidden="true" />
			<ChevronDown class="size-3 opacity-60" aria-hidden="true" />
		</DropdownMenu.Trigger>
		<DropdownMenu.Portal>
			<DropdownMenu.Content
				align="start"
				sideOffset={4}
				class="{menu} min-w-48"
				data-interactive
				data-doc-popup
				onCloseAutoFocus={refocus}
			>
				{#each TABLE_ACTIONS.filter((a) => canDelete || a.id !== 'deleteTable') as a (a.id)}
					{#if a.separated}<DropdownMenu.Separator class="my-1 h-px bg-border" />{/if}
					<DropdownMenu.Item
						class="{menuItem} data-[disabled]:opacity-40"
						disabled={enabled[a.id] === false}
						onSelect={() => a.run(editor)}
					>
						<span class="w-4 shrink-0">
							{#if a.id === 'headerRow' && header}<Check class="size-4" aria-hidden="true" />{/if}
						</span>
						{a.label}
					</DropdownMenu.Item>
				{/each}
			</DropdownMenu.Content>
		</DropdownMenu.Portal>
	</DropdownMenu.Root>
{:else}
	<button
		type="button"
		class={button}
		aria-label="Insert table"
		title="Insert table"
		onmousedown={(e) => e.preventDefault()}
		onclick={() => insertTable(editor)}
	>
		<TableIcon class="size-[18px]" aria-hidden="true" />
	</button>
{/if}
