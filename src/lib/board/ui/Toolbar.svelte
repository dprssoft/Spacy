<script lang="ts">
	import { DropdownMenu, Tooltip } from 'bits-ui';
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import Brush from '@lucide/svelte/icons/brush';
	import Eraser from '@lucide/svelte/icons/eraser';
	import FileText from '@lucide/svelte/icons/file-text';
	import Frame from '@lucide/svelte/icons/frame';
	import LayoutTemplate from '@lucide/svelte/icons/layout-template';
	import Clapperboard from '@lucide/svelte/icons/clapperboard';
	import Plus from '@lucide/svelte/icons/plus';
	import Hand from '@lucide/svelte/icons/hand';
	import ImageIcon from '@lucide/svelte/icons/image';
	import Lock from '@lucide/svelte/icons/lock';
	import LockOpen from '@lucide/svelte/icons/lock-open';
	import MousePointer2 from '@lucide/svelte/icons/mouse-pointer-2';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Square from '@lucide/svelte/icons/square';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import StickyNote from '@lucide/svelte/icons/sticky-note';
	import Type from '@lucide/svelte/icons/type';
	import type { ShapeKind } from '$lib/model/types';
	import { SHAPE_DRAG_TYPE, SHAPE_KINDS, shapePath } from '../elements/shape/paths';
	import { getBoard } from '../context';
	import { openImagePicker } from '../images/importImages';
	import type { ToolId } from '../tools/types';
	import { activeDocEditor } from '../doccards/activeEditor.svelte';
	import DocRibbon from '../doccards/DocRibbon.svelte';
	import { button, caption, groupBox } from './ribbon';
	import { rovingTabindex } from './rovingTabindex';
	import MediaLinkPopover from './MediaLinkPopover.svelte';
	import SketchRibbon from './SketchRibbon.svelte';
	import { templateGallery } from './templateGalleryState.svelte';
	import { mediaPrompt } from './mediaPromptState.svelte';
	import { keyboard } from '$lib/shared/keyboard.svelte';
	import { layout } from '$lib/shared/layout.svelte';

	const ctx = getBoard();
	const { tools } = ctx;
	/** Buttons that run an action instead of selecting a tool. */
	const actions: Partial<Record<ToolId, () => void>> = { image: () => openImagePicker(ctx) };

	type IconComponent = typeof Square;
	/** `secondary`: on phones it moves into the Insert menu. */
	type Item = { id: ToolId; label: string; keys: string; icon: IconComponent; secondary?: boolean };
	const groups: Item[][] = [
		[
			{ id: 'select', label: 'Select', keys: 'V', icon: MousePointer2 },
			{ id: 'hand', label: 'Hand', keys: 'H', icon: Hand }
		],
		[
			{ id: 'pen', label: 'Pen', keys: 'P', icon: Pencil },
			{ id: 'sketch', label: 'Sketch', keys: 'B', icon: Brush, secondary: true },
			{ id: 'eraser', label: 'Eraser', keys: 'E', icon: Eraser, secondary: true }
		],
		[
			// 'shape' is rendered as a flyout (below); listed here to keep the order.
			{ id: 'shape', label: 'Shapes', keys: 'R', icon: Square },
			{ id: 'connector', label: 'Connector', keys: 'A', icon: ArrowUpRight, secondary: true },
			{ id: 'text', label: 'Text', keys: 'T', icon: Type },
			{ id: 'sticky', label: 'Sticky note', keys: 'S', icon: StickyNote },
			{ id: 'doccard', label: 'Doc card', keys: 'N', icon: FileText, secondary: true },
			{ id: 'frame', label: 'Frame', keys: 'F', icon: Frame, secondary: true },
			{ id: 'image', label: 'Image', keys: 'Ctrl+Shift+I', icon: ImageIcon, secondary: true },
			{ id: 'waystone', label: 'Waystone', keys: 'W', icon: MapPin, secondary: true }
		]
	];

	const KEYS: Partial<Record<ShapeKind, string>> = { rect: 'R', ellipse: 'O', diamond: 'D' };
	const shapes = SHAPE_KINDS;
	const currentShape = $derived(shapes.find((s) => s.kind === tools.shapeKind) ?? shapes[0]!);
	const iconPath = (kind: ShapeKind) => shapePath(kind, 16, 12, 2, 1);

	// Ribbon groups, in the order of `groups`.
	const GROUP_NAMES = ['Select', 'Draw', 'Insert'];
	const tip = 'z-50 rounded-md bg-text px-2 py-1 text-xs font-medium text-bg shadow-md';
	const menuItem =
		'flex h-8 cursor-default items-center gap-2 rounded-md px-2 text-sm outline-none select-none data-[highlighted]:bg-surface-2';

	// Phones while editing: the tools step aside; a doc card's formatting row docks on the keyboard.
	const editingCompact = $derived(layout.compact && !!ctx.selection.editingId);

	function select(id: ToolId) {
		if (tools.isAvailable(id)) tools.setTool(id);
	}
</script>

{#snippet tooltip(text: string)}
	<Tooltip.Portal>
		<Tooltip.Content side="bottom" sideOffset={6} class={tip}>{text}</Tooltip.Content>
	</Tooltip.Portal>
{/snippet}

<div
	role="toolbar"
	aria-label="Tools"
	aria-orientation="horizontal"
	{@attach rovingTabindex()}
	data-interactive
	data-testid="toolbar"
	class="flex shrink-0 items-stretch overflow-x-auto border-b border-border bg-surface px-1 max-sm:order-last max-sm:border-t max-sm:border-b-0 max-sm:pb-[env(safe-area-inset-bottom)]"
	class:hidden={editingCompact && !activeDocEditor.current}
	class:docked={editingCompact && !!activeDocEditor.current}
	style:bottom={editingCompact ? `${keyboard.inset}px` : undefined}
>
	{#if !editingCompact}
		{#each groups as group, gi (gi)}
			<div role="group" aria-label={GROUP_NAMES[gi]} class={groupBox}>
				<div class="flex items-center gap-0.5">
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
													<button
														{...props}
														type="button"
														class={button}
														aria-label="Shapes ({currentShape.label})"
														aria-haspopup="menu"
														data-tool="shape"
														aria-pressed={tools.current === 'shape'}
														aria-disabled={!available}
													>
														<svg viewBox="-1 -1 18 14" class="size-[18px]" aria-hidden="true">
															<path
																d={iconPath(currentShape.kind)}
																fill="none"
																stroke="currentColor"
																stroke-width="1.5"
															/>
														</svg>
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
										side="bottom"
										align="start"
										sideOffset={6}
										class="z-50 min-w-48 rounded-lg border border-border bg-surface p-1 shadow-lg"
									>
										{#each ['Basic', 'Flowchart'] as group (group)}
											<DropdownMenu.Group>
												<DropdownMenu.GroupHeading
													class="px-2 pt-1.5 pb-0.5 text-xs font-medium text-muted"
													>{group}</DropdownMenu.GroupHeading
												>
												{#each shapes.filter((x) => x.group === group) as s (s.kind)}
													<DropdownMenu.Item
														class={menuItem}
														disabled={!available}
														draggable="true"
														ondragstart={(e: DragEvent) => {
															e.dataTransfer?.setData(SHAPE_DRAG_TYPE, s.kind);
															if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
														}}
														onSelect={() => {
															tools.shapeKind = s.kind;
															select('shape');
														}}
													>
														<svg viewBox="-1 -1 18 14" class="size-4" aria-hidden="true">
															<path
																d={iconPath(s.kind)}
																fill="none"
																stroke="currentColor"
																stroke-width="1.5"
															/>
														</svg>
														<span class="flex-1">{s.label}</span>
														{#if KEYS[s.kind]}<kbd class="text-xs text-muted">{KEYS[s.kind]}</kbd
															>{/if}
													</DropdownMenu.Item>
												{/each}
											</DropdownMenu.Group>
										{/each}
									</DropdownMenu.Content>
								</DropdownMenu.Portal>
							</DropdownMenu.Root>
						{:else}
							{@const Icon = item.icon}
							<Tooltip.Root>
								<Tooltip.Trigger
									class="{button} {item.secondary ? 'max-sm:hidden' : ''}"
									aria-label="{item.label} ({item.keys})"
									aria-keyshortcuts={item.keys}
									data-tool={item.id}
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
					{#if GROUP_NAMES[gi] === 'Insert'}
						<MediaLinkPopover {button} {tip} />
						<Tooltip.Root>
							<Tooltip.Trigger
								class="{button} max-sm:hidden"
								aria-label="Templates (Shift+T)"
								aria-keyshortcuts="Shift+T"
								aria-haspopup="dialog"
								data-tool="templates"
								onclick={() => (templateGallery.open = true)}
							>
								<LayoutTemplate class="size-[18px]" aria-hidden="true" />
							</Tooltip.Trigger>
							{@render tooltip('Templates — Shift+T')}
						</Tooltip.Root>
						<!-- Phones: the secondary tools live in one menu. -->
						<DropdownMenu.Root>
							<DropdownMenu.Trigger
								class="{button} sm:hidden"
								aria-label="Insert more"
								data-insert-menu
							>
								<Plus class="size-[18px]" aria-hidden="true" />
							</DropdownMenu.Trigger>
							<DropdownMenu.Portal>
								<DropdownMenu.Content
									side="top"
									align="end"
									sideOffset={6}
									data-interactive
									class="z-50 min-w-52 rounded-lg border border-border bg-surface p-1 shadow-lg"
								>
									{#each groups.flat().filter((i) => i.secondary) as it (it.id)}
										{@const Icon = it.icon}
										<DropdownMenu.Item
											class={menuItem}
											onSelect={() => (actions[it.id] ? actions[it.id]!() : select(it.id))}
										>
											<Icon class="size-4" aria-hidden="true" />{it.label}
										</DropdownMenu.Item>
									{/each}
									<DropdownMenu.Item class={menuItem} onSelect={() => (mediaPrompt.open = true)}>
										<Clapperboard class="size-4" aria-hidden="true" />Media…
									</DropdownMenu.Item>
									<DropdownMenu.Item
										class={menuItem}
										onSelect={() => (templateGallery.open = true)}
									>
										<LayoutTemplate class="size-4" aria-hidden="true" />Templates…
									</DropdownMenu.Item>
								</DropdownMenu.Content>
							</DropdownMenu.Portal>
						</DropdownMenu.Root>
					{/if}
				</div>
				<span class="{caption} max-sm:hidden" aria-hidden="true">{GROUP_NAMES[gi]}</span>
			</div>
		{/each}
		<div role="group" aria-label="Options" class="{groupBox} max-sm:hidden">
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
			<span class={caption} aria-hidden="true">Options</span>
		</div>
	{/if}
	{#if tools.current === 'sketch'}
		<SketchRibbon {groupBox} {caption} {button} />
	{/if}
	{#if activeDocEditor.current}
		<DocRibbon editor={activeDocEditor.current} />
	{/if}
</div>

<style>
	.docked {
		position: fixed;
		left: 0;
		right: 0;
		z-index: 40;
		padding-bottom: 0;
	}
</style>
