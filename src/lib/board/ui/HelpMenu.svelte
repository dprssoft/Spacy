<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import CircleQuestionMark from '@lucide/svelte/icons/circle-question-mark';
	import AboutDialog from '$lib/home/AboutDialog.svelte';
	import { help } from './helpState.svelte';

	let { class: className = '' }: { class?: string } = $props();

	const item =
		'flex h-8 cursor-default items-center justify-between gap-6 rounded-md px-2 text-sm outline-none select-none data-[highlighted]:bg-surface-2';
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger class={className} aria-label="Help">
		<CircleQuestionMark class="size-4" aria-hidden="true" />
	</DropdownMenu.Trigger>
	<DropdownMenu.Portal>
		<DropdownMenu.Content
			side="top"
			align="end"
			sideOffset={6}
			class="z-50 min-w-52 rounded-lg border border-border bg-surface p-1 shadow-lg"
		>
			<DropdownMenu.Item class={item} onSelect={() => (help.shortcutsOpen = true)}>
				Keyboard shortcuts <kbd class="font-sans text-xs text-muted">?</kbd>
			</DropdownMenu.Item>
			<DropdownMenu.Item class={item} onSelect={() => help.showTips()}>
				Show tips again
			</DropdownMenu.Item>
			<DropdownMenu.Item class={item} onSelect={() => (help.aboutOpen = true)}>
				About
			</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>
<AboutDialog bind:open={help.aboutOpen} />
