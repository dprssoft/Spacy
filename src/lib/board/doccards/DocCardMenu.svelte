<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import Copy from '@lucide/svelte/icons/copy';
	import Download from '@lucide/svelte/icons/download';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import { getBoard } from '../context';
	import { copyMarkdown, downloadMarkdown } from './exportMarkdown';

	let { cardId, class: className = '' }: { cardId: string; class?: string } = $props();

	const ctx = getBoard();
	const item =
		'flex h-8 cursor-default items-center gap-2 rounded-md px-2 text-sm text-text outline-none select-none data-[highlighted]:bg-surface-2';
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger
		class={className}
		aria-label="Doc card options"
		title="Doc card options"
		data-interactive
		onpointerdown={(e: PointerEvent) => e.stopPropagation()}
	>
		<Ellipsis class="size-4" aria-hidden="true" />
	</DropdownMenu.Trigger>
	<DropdownMenu.Portal>
		<DropdownMenu.Content
			align="end"
			sideOffset={4}
			class="z-[70] min-w-48 rounded-lg border border-border bg-surface p-1 shadow-lg"
			data-interactive
			data-doc-popup
		>
			<DropdownMenu.Item class={item} onSelect={() => copyMarkdown(ctx, cardId)}>
				<Copy class="size-4 text-muted" aria-hidden="true" />Copy as Markdown
			</DropdownMenu.Item>
			<DropdownMenu.Item class={item} onSelect={() => downloadMarkdown(ctx, cardId)}>
				<Download class="size-4 text-muted" aria-hidden="true" />Download .md
			</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>
