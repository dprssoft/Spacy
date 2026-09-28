<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Download from '@lucide/svelte/icons/download';
	import { resolve } from '$app/paths';
	import InlineEditable from '$lib/shared/ui/InlineEditable.svelte';
	import Logo from '$lib/shared/ui/Logo.svelte';
	import ThemeToggle from '$lib/shared/ui/ThemeToggle.svelte';
	import SaveIndicator from './SaveIndicator.svelte';
	import type { BoardTitle } from './title.svelte';

	let { title }: { title: BoardTitle } = $props();

	let editing = $state(false);

	const item =
		'flex h-8 cursor-default items-center rounded-md px-2 text-sm outline-none select-none data-[disabled]:opacity-40 data-[highlighted]:bg-surface-2';
</script>

<header class="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-surface px-2">
	<a
		href={resolve('/')}
		aria-label="Back to boards"
		class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
	>
		<Logo class="size-6" />
	</a>

	<div class="max-w-md min-w-0">
		{#if editing}
			<InlineEditable
				value={title.value}
				bind:editing
				ariaLabel="Board title"
				inputClass="text-sm font-medium"
				onCommit={(t) => title.rename(t)}
			/>
		{:else}
			<button
				type="button"
				onclick={() => (editing = true)}
				aria-label="Rename board: {title.value}"
				title="Rename"
				class="block max-w-full truncate rounded-md px-1.5 py-1 text-sm font-medium hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
			>
				{title.value}
			</button>
		{/if}
	</div>

	<div class="ml-auto flex items-center gap-1">
		<SaveIndicator />
		<DropdownMenu.Root>
			<DropdownMenu.Trigger
				class="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
			>
				<Download class="size-4" aria-hidden="true" />
				Export
				<ChevronDown class="size-3.5 text-muted" aria-hidden="true" />
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content
					align="end"
					sideOffset={4}
					class="z-50 min-w-48 rounded-lg border border-border bg-surface p-1 shadow-lg"
				>
					<DropdownMenu.Item class={item} disabled>PNG…</DropdownMenu.Item>
					<DropdownMenu.Item class={item} disabled>SVG…</DropdownMenu.Item>
					<DropdownMenu.Item class={item} disabled>Download .smthng</DropdownMenu.Item>
					<p class="px-2 pt-1 pb-0.5 text-xs text-muted">Coming soon</p>
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
		<ThemeToggle />
	</div>
</header>
