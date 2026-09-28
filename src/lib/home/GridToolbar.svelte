<script lang="ts">
	import { Select } from 'bits-ui';
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import List from '@lucide/svelte/icons/list';
	import type { BoardFilter, BoardSort } from '$lib/storage/types';
	import type { Layout } from './homeUI.svelte';
	import { VIEWS } from './views';

	let {
		view,
		sort = $bindable(),
		layout = $bindable(),
		onEmptyTrash
	}: {
		view: BoardFilter;
		sort: BoardSort;
		layout: Layout;
		/** Shown in the trash view when it has boards. */
		onEmptyTrash?: () => void;
	} = $props();

	const title = $derived(VIEWS.find((v) => v.id === view)?.title ?? '');

	const sorts: { value: BoardSort; label: string }[] = [
		{ value: 'opened', label: 'Last opened' },
		{ value: 'updated', label: 'Last edited' },
		{ value: 'created', label: 'Date created' },
		{ value: 'title', label: 'Name' }
	];
	const sortLabel = $derived(sorts.find((s) => s.value === sort)?.label ?? '');

	const toggle =
		'inline-flex size-8 items-center justify-center rounded-md text-muted transition hover:text-text aria-pressed:bg-surface aria-pressed:text-text aria-pressed:shadow-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none';
</script>

<div class="mb-3 flex min-h-9 items-center gap-2">
	<h2 id="board-grid-title" class="text-sm font-semibold text-muted">{title}</h2>
	<div class="ml-auto flex items-center gap-2">
		{#if onEmptyTrash}
			<button
				type="button"
				onclick={onEmptyTrash}
				class="h-8 rounded-md px-2.5 text-sm font-medium text-danger hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-danger focus-visible:outline-none"
			>
				Empty trash
			</button>
		{/if}
		{#if view !== 'recent'}
			<Select.Root type="single" bind:value={sort} items={sorts}>
				<Select.Trigger
					aria-label="Sort boards"
					class="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm text-muted hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
				>
					Sort: <span class="text-text">{sortLabel}</span>
					<ChevronDown class="size-3.5" aria-hidden="true" />
				</Select.Trigger>
				<Select.Portal>
					<Select.Content
						sideOffset={4}
						class="z-50 min-w-40 rounded-lg border border-border bg-surface p-1 shadow-lg"
					>
						{#each sorts as option (option.value)}
							<Select.Item
								value={option.value}
								label={option.label}
								class="flex h-8 cursor-default items-center gap-2 rounded-md px-2 text-sm outline-none select-none data-[highlighted]:bg-surface-2"
							>
								{#snippet children({ selected })}
									<Check class="size-3.5 {selected ? '' : 'invisible'}" aria-hidden="true" />
									{option.label}
								{/snippet}
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Portal>
			</Select.Root>
		{/if}
		<div class="flex rounded-lg bg-surface-2 p-0.5" role="group" aria-label="Layout">
			<button
				type="button"
				class={toggle}
				aria-label="Grid view"
				aria-pressed={layout === 'grid'}
				onclick={() => (layout = 'grid')}
			>
				<LayoutGrid class="size-4" aria-hidden="true" />
			</button>
			<button
				type="button"
				class={toggle}
				aria-label="List view"
				aria-pressed={layout === 'list'}
				onclick={() => (layout = 'list')}
			>
				<List class="size-4" aria-hidden="true" />
			</button>
		</div>
	</div>
</div>
