<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import type { MoreItem } from './menuItem';

	let { items, btn }: { items: (MoreItem | null)[]; btn: string } = $props();

	const item =
		'flex h-8 cursor-default items-center justify-between gap-6 rounded-md px-2 text-sm outline-none select-none data-[disabled]:opacity-40 data-[highlighted]:bg-surface-2';
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger class={btn} aria-label="More media options" title="More options">
		<Ellipsis class="size-4" aria-hidden="true" />
	</DropdownMenu.Trigger>
	<DropdownMenu.Portal>
		<DropdownMenu.Content
			side="top"
			align="end"
			sideOffset={8}
			data-interactive
			class="z-50 min-w-52 rounded-lg border border-border bg-surface p-1 shadow-lg"
		>
			{#each items as it, i (i)}
				{#if it === null}
					<DropdownMenu.Separator class="my-1 h-px bg-border" />
				{:else if it.checked !== undefined}
					<DropdownMenu.CheckboxItem
						class={item}
						checked={it.checked}
						disabled={it.disabled}
						onCheckedChange={() => it.run()}
					>
						<span>{it.checked ? '✓ ' : ''}{it.label}</span>
						{#if it.keys}<kbd class="font-sans text-xs text-muted">{it.keys}</kbd>{/if}
					</DropdownMenu.CheckboxItem>
				{:else}
					<DropdownMenu.Item class={item} disabled={it.disabled} onSelect={() => it.run()}>
						<span>{it.label}</span>
						{#if it.keys}<kbd class="font-sans text-xs text-muted">{it.keys}</kbd>{/if}
					</DropdownMenu.Item>
				{/if}
			{/each}
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>
