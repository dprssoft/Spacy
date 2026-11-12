<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import Plus from '@lucide/svelte/icons/plus';
	import { MAX_PAGE_NAME } from '$lib/model/pages';
	import ConfirmDialog from '$lib/shared/ui/ConfirmDialog.svelte';
	import { getBoard } from '../context';
	import { isNoopSlot, slotToIndex, trackTabDrag } from './tabDrag';
	import { scrollFade } from './scrollFade';

	// Sheet tabs: click to switch, double-click to rename, right-click (or the menu key) for more.
	// Ctrl/Cmd-click and Shift-click pick several tabs; the menu then acts on all of them.
	// Drag a tab (or Ctrl/Cmd+Shift+Arrow) to reorder.
	const { pages } = getBoard();

	let renaming = $state<string | null>(null);
	let draft = $state('');
	let menuFor = $state<string | null>(null);
	let deleting = $state<string[]>([]);
	let confirmOpen = $state(false);
	let tablist = $state<HTMLElement>();
	/** The tab being dragged and the gap it would drop into. */
	let drag = $state<{ id: string; from: number; slot: number } | null>(null);
	let swallowClick = false;

	const deleteTitle = $derived(
		deleting.length === 1
			? `Delete “${pages.list.find((p) => p.id === deleting[0])?.name ?? ''}”?`
			: `Delete ${deleting.length} pages?`
	);

	function startRename(id: string) {
		draft = pages.list.find((p) => p.id === id)?.name ?? '';
		renaming = id;
	}
	function commitRename() {
		if (renaming) pages.rename(renaming, draft);
		renaming = null;
	}
	function focusAndSelect(node: HTMLInputElement) {
		node.focus();
		node.select();
	}

	function onTabPointerDown(e: PointerEvent, id: string, from: number) {
		// Touch drags scroll the tab strip; touch users reorder from the menu.
		if (e.button !== 0 || e.pointerType === 'touch' || e.ctrlKey || e.metaKey || e.shiftKey) return;
		trackTabDrag(e, {
			tabs: () => [...(tablist?.querySelectorAll('[data-page-tab]') ?? [])],
			onMove: (slot) => (drag = { id, from, slot }),
			onEnd: (slot) => {
				drag = null;
				// The click that ends a drag must not switch pages.
				swallowClick = true;
				setTimeout(() => (swallowClick = false));
				if (slot !== null && !isNoopSlot(from, slot)) pages.moveTo(id, slotToIndex(from, slot));
			}
		});
	}

	function focusTab(id: string) {
		queueMicrotask(() => document.querySelector<HTMLElement>(`[data-page-tab="${id}"]`)?.focus());
	}

	// With no scrollbar, the current tab must never hide behind the fade.
	$effect(() => {
		const id = pages.current;
		tablist
			?.querySelector(`[data-page-tab="${id}"]`)
			?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	});

	function onTabClick(e: MouseEvent, id: string) {
		if (swallowClick) return;
		if (e.ctrlKey || e.metaKey) pages.togglePick(id);
		else if (e.shiftKey) pages.pickRange(id);
		else pages.select(id);
	}

	function openMenu(id: string) {
		// Opening the menu on a picked tab keeps the others picked.
		if (!pages.selectedIds.includes(id)) pages.select(id);
		menuFor = id;
	}

	function onTabKeydown(e: KeyboardEvent, index: number) {
		const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
		if (step && (e.ctrlKey || e.metaKey) && e.shiftKey) {
			e.preventDefault();
			e.stopPropagation();
			const id = pages.list[index]!.id;
			pages.move(id, step);
			focusTab(id);
		} else if (step) {
			const next = pages.list[(index + step + pages.list.length) % pages.list.length];
			if (!next) return;
			e.preventDefault();
			pages.select(next.id);
			focusTab(next.id);
		} else if (e.key === 'F2') {
			e.preventDefault();
			startRename(pages.list[index]!.id);
		}
	}

	const item =
		'flex h-8 cursor-default items-center rounded-md px-2 text-sm outline-none select-none data-[disabled]:opacity-40 data-[highlighted]:bg-surface-2';
</script>

<div class="flex min-w-0 items-stretch">
	<div
		bind:this={tablist}
		{@attach scrollFade}
		role="tablist"
		aria-label="Pages"
		class="flex min-w-0 items-stretch overflow-x-auto"
	>
		{#each pages.list as page, i (page.id)}
			{#if drag && drag.slot === i && !isNoopSlot(drag.from, i)}
				{@render dropMark()}
			{/if}
			{@const active = page.id === pages.current}
			{@const picked = pages.picked.includes(page.id)}
			{@const targets = menuFor === page.id ? pages.targets(page.id) : [page.id]}
			{@const many = targets.length > 1}
			{#if renaming === page.id}
				<input
					{@attach focusAndSelect}
					bind:value={draft}
					maxlength={MAX_PAGE_NAME}
					aria-label="Page name"
					class="my-0.5 w-28 rounded-sm border border-accent bg-surface px-2 text-xs outline-none"
					onblur={commitRename}
					onkeydown={(e) => {
						e.stopPropagation();
						if (e.key === 'Enter') commitRename();
						else if (e.key === 'Escape') renaming = null;
					}}
				/>
			{:else}
				<DropdownMenu.Root
					open={menuFor === page.id}
					onOpenChange={(o) => (menuFor = o ? page.id : null)}
				>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<!-- The menu opens on right-click, not on click: a click switches pages. -->
							<button
								{...props}
								type="button"
								role="tab"
								aria-selected={active}
								aria-haspopup="menu"
								tabindex={active ? 0 : -1}
								data-page-tab={page.id}
								data-picked={picked || undefined}
								data-dragging={drag?.id === page.id || undefined}
								title="{page.name} — double-click to rename, drag to reorder, right-click for more, Ctrl-click to pick several"
								class="max-w-40 shrink-0 truncate border-r border-border px-3 text-xs whitespace-nowrap text-muted hover:bg-surface hover:text-text focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none focus-visible:ring-inset aria-selected:bg-surface aria-selected:font-medium aria-selected:text-text aria-selected:shadow-[inset_0_-2px_0_var(--accent)] data-[dragging]:opacity-50 data-[picked]:bg-surface data-[picked]:text-text data-[picked]:shadow-[inset_0_-2px_0_var(--muted)]"
								onpointerdown={(e) => onTabPointerDown(e, page.id, i)}
								onclick={(e) => onTabClick(e, page.id)}
								ondblclick={() => startRename(page.id)}
								oncontextmenu={(e) => {
									e.preventDefault();
									openMenu(page.id);
								}}
								onkeydown={(e) => {
									if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
										e.preventDefault();
										openMenu(page.id);
									} else onTabKeydown(e, i);
								}}
							>
								{page.name}
							</button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Portal>
						<DropdownMenu.Content
							side="top"
							align="start"
							sideOffset={4}
							class="z-50 min-w-44 rounded-lg border border-border bg-surface p-1 shadow-lg"
						>
							<DropdownMenu.Item class={item} disabled={many} onSelect={() => startRename(page.id)}>
								Rename
							</DropdownMenu.Item>
							<DropdownMenu.Item
								class={item}
								onSelect={() => {
									for (const id of targets) pages.duplicate(id);
								}}
							>
								{many ? `Duplicate ${targets.length} pages` : 'Duplicate'}
							</DropdownMenu.Item>
							<DropdownMenu.Item
								class={item}
								disabled={many || i === 0}
								onSelect={() => pages.move(page.id, -1)}
							>
								Move left
							</DropdownMenu.Item>
							<DropdownMenu.Item
								class={item}
								disabled={many || i === pages.list.length - 1}
								onSelect={() => pages.move(page.id, 1)}
							>
								Move right
							</DropdownMenu.Item>
							<DropdownMenu.Separator class="my-1 h-px bg-border" />
							<DropdownMenu.Item
								class="{item} text-danger"
								disabled={targets.length >= pages.list.length}
								onSelect={() => {
									deleting = targets;
									confirmOpen = true;
								}}
							>
								{many ? `Delete ${targets.length} pages` : 'Delete'}
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Portal>
				</DropdownMenu.Root>
			{/if}
		{/each}
		{#if drag && drag.slot === pages.list.length && !isNoopSlot(drag.from, drag.slot)}
			{@render dropMark()}
		{/if}
	</div>
	<button
		type="button"
		aria-label="Add page"
		title="Add page"
		class="inline-flex w-8 shrink-0 items-center justify-center text-muted hover:bg-surface hover:text-text focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none focus-visible:ring-inset"
		onclick={() => pages.add()}
	>
		<Plus class="size-4" aria-hidden="true" />
	</button>
</div>

{#snippet dropMark()}
	<!-- Zero net width, so showing it doesn't shift the tabs under the pointer. -->
	<span
		aria-hidden="true"
		data-testid="page-drop-mark"
		class="z-10 -mx-px my-1 w-0.5 shrink-0 rounded bg-accent"
	></span>
{/snippet}

<ConfirmDialog
	bind:open={confirmOpen}
	title={deleteTitle}
	description="Everything on {deleting.length === 1
		? 'this page'
		: 'these pages'} is deleted. This can’t be undone, and it clears the undo history."
	confirmLabel={deleting.length === 1 ? 'Delete page' : `Delete ${deleting.length} pages`}
	danger
	onConfirm={() => {
		pages.remove(deleting);
		deleting = [];
	}}
/>
