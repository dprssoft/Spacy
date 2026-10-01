<script lang="ts">
	import { DropdownMenu, Tooltip } from 'bits-ui';
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import Circle from '@lucide/svelte/icons/circle';
	import Diamond from '@lucide/svelte/icons/diamond';
	import Eraser from '@lucide/svelte/icons/eraser';
	import FileText from '@lucide/svelte/icons/file-text';
	import Frame from '@lucide/svelte/icons/frame';
	import Hand from '@lucide/svelte/icons/hand';
	import ImageIcon from '@lucide/svelte/icons/image';
	import Lock from '@lucide/svelte/icons/lock';
	import LockOpen from '@lucide/svelte/icons/lock-open';
	import MousePointer2 from '@lucide/svelte/icons/mouse-pointer-2';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Square from '@lucide/svelte/icons/square';
	import StickyNote from '@lucide/svelte/icons/sticky-note';
	import Type from '@lucide/svelte/icons/type';
	import type { ShapeKind } from '$lib/model/types';
	import { getBoard } from '../context';
	import { openImagePicker } from '../images/importImages';
	import type { ToolId } from '../tools/types';

	const ctx = getBoard();
	const { tools } = ctx;
	/** Buttons that run an action instead of selecting a tool. */
	const actions: Partial<Record<ToolId, () => void>> = { image: () => openImagePicker(ctx) };

	type IconComponent = typeof Square;
	type Item = { id: ToolId; label: string; keys: string; icon: IconComponent };
	const groups: Item[][] = [
		[
			{ id: 'select', label: 'Select', keys: 'V', icon: MousePointer2 },
			{ id: 'hand', label: 'Hand', keys: 'H', icon: Hand }
		],
		[
			{ id: 'pen', label: 'Pen', keys: 'P', icon: Pencil },
			{ id: 'eraser', label: 'Eraser', keys: 'E', icon: Eraser }
		],
		[
			// 'shape' is rendered as a flyout (below); listed here to keep the order.
			{ id: 'shape', label: 'Shapes', keys: 'R', icon: Square },
			{ id: 'connector', label: 'Connector', keys: 'A', icon: ArrowUpRight },
			{ id: 'text', label: 'Text', keys: 'T', icon: Type },
			{ id: 'sticky', label: 'Sticky note', keys: 'S', icon: StickyNote },
			{ id: 'doccard', label: 'Doc card', keys: 'N', icon: FileText },
			{ id: 'frame', label: 'Frame', keys: 'F', icon: Frame },
			{ id: 'image', label: 'Image', keys: 'Ctrl+Shift+I', icon: ImageIcon }
		]
	];

	const shapes: {
		kind: ShapeKind;
		label: string;
		keys: string;
		icon: IconComponent;
	}[] = [
		{ kind: 'rect', label: 'Rectangle', keys: 'R', icon: Square },
		{ kind: 'ellipse', label: 'Ellipse', keys: 'O', icon: Circle },
		{ kind: 'diamond', label: 'Diamond', keys: 'D', icon: Diamond }
	];
	const currentShape = $derived(shapes.find((s) => s.kind === tools.shapeKind) ?? shapes[0]!);

	const button =
		'relative inline-flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none aria-pressed:bg-accent aria-pressed:text-accent-contrast aria-disabled:cursor-not-allowed aria-disabled:opacity-35 aria-disabled:hover:bg-transparent';
	const tip = 'z-50 rounded-md bg-text px-2 py-1 text-xs font-medium text-bg shadow-md';
	const menuItem =
		'flex h-8 cursor-default items-center gap-2 rounded-md px-2 text-sm outline-none select-none data-[highlighted]:bg-surface-2';

	function select(id: ToolId) {
		if (tools.isAvailable(id)) tools.setTool(id);
	}
</script>

{#snippet tooltip(text: string)}
	<Tooltip.Portal>
		<Tooltip.Content side="right" sideOffset={8} class={tip}>{text}</Tooltip.Content>
	</Tooltip.Portal>
{/snippet}

<div
	role="toolbar"
	aria-label="Tools"
	aria-orientation="vertical"
	data-interactive
	class="absolute top-1/2 left-3 z-20 flex -translate-y-1/2 flex-col gap-1 rounded-xl border border-border bg-surface p-1 shadow-md max-sm:top-auto max-sm:bottom-3 max-sm:left-1/2 max-sm:-translate-x-1/2 max-sm:translate-y-0 max-sm:flex-row"
>
	{#each groups as group, gi (gi)}
		{#if gi > 0}<div
				class="mx-1.5 my-0.5 h-px bg-border max-sm:mx-0.5 max-sm:my-1.5 max-sm:h-auto max-sm:w-px"
			></div>{/if}
		{#each group as item (item.id)}
			{@const action = actions[item.id]}
			{@const available = !!action || tools.isAvailable(item.id)}
			{#if item.id === 'shape'}
				<DropdownMenu.Root>
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props: tipProps })}
								<DropdownMenu.Trigger {...tipProps}>
									{#snippet child({ props })}
										{@const Icon = currentShape.icon}
										<button
											{...props}
											type="button"
											class={button}
											aria-label="Shapes"
											aria-pressed={tools.current === 'shape'}
											aria-disabled={!available}
										>
											<Icon class="size-[18px]" aria-hidden="true" />
											<span
												class="absolute right-0.5 bottom-0.5 size-0 border-4 border-transparent border-r-current border-b-current opacity-50"
												aria-hidden="true"
											></span>
										</button>
									{/snippet}
								</DropdownMenu.Trigger>
							{/snippet}
						</Tooltip.Trigger>
						{@render tooltip(available ? 'Shapes' : 'Shapes — coming soon')}
					</Tooltip.Root>
					<DropdownMenu.Portal>
						<DropdownMenu.Content
							side="right"
							sideOffset={8}
							class="z-50 min-w-44 rounded-lg border border-border bg-surface p-1 shadow-lg"
						>
							{#each shapes as s (s.kind)}
								{@const Icon = s.icon}
								<DropdownMenu.Item
									class={menuItem}
									disabled={!available}
									onSelect={() => {
										tools.shapeKind = s.kind;
										select('shape');
									}}
								>
									<Icon class="size-4" aria-hidden="true" />
									<span class="flex-1">{s.label}</span>
									<kbd class="text-xs text-muted">{s.keys}</kbd>
								</DropdownMenu.Item>
							{/each}
						</DropdownMenu.Content>
					</DropdownMenu.Portal>
				</DropdownMenu.Root>
			{:else}
				{@const Icon = item.icon}
				<Tooltip.Root>
					<Tooltip.Trigger
						class={button}
						aria-label={item.label}
						aria-keyshortcuts={item.keys}
						aria-pressed={action ? undefined : tools.current === item.id}
						aria-disabled={!available}
						onclick={() => (action ? action() : select(item.id))}
					>
						<Icon class="size-[18px]" aria-hidden="true" />
					</Tooltip.Trigger>
					{@render tooltip(
						available ? `${item.label} — ${item.keys}` : `${item.label} — coming soon`
					)}
				</Tooltip.Root>
			{/if}
		{/each}
	{/each}
	<div
		class="mx-1.5 my-0.5 h-px bg-border max-sm:mx-0.5 max-sm:my-1.5 max-sm:h-auto max-sm:w-px"
	></div>
	<Tooltip.Root>
		<Tooltip.Trigger
			class={button}
			aria-label="Keep tool active"
			aria-pressed={tools.locked}
			onclick={() => (tools.locked = !tools.locked)}
		>
			{#if tools.locked}
				<Lock class="size-[18px]" aria-hidden="true" />
			{:else}
				<LockOpen class="size-[18px]" aria-hidden="true" />
			{/if}
		</Tooltip.Trigger>
		{@render tooltip(tools.locked ? 'Tool stays active' : 'Keep tool active after use')}
	</Tooltip.Root>
</div>
