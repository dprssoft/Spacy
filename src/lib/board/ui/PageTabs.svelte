<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import ConfirmDialog from '$lib/shared/ui/ConfirmDialog.svelte';
	import { getBoard } from '../context';
	import FolderTab from './FolderTab.svelte';
	import PageTab from './PageTab.svelte';
	import TabNameInput from './TabNameInput.svelte';
	import { folderDrop, isNoopPageDrop, itemKey, pageDrop, stripItems } from './pageStrip';
	import { scrollFade } from './scrollFade';
	import { trackTabDrag } from './tabDrag';

	// Sheet tabs: click to switch, double-click to rename, right-click (or the menu key) for more.
	// Ctrl/Cmd-click and Shift-click pick several tabs; the menu then acts on all of them.
	// Drag a tab (or Ctrl/Cmd+Shift+Arrow) to reorder. Folder chips open and close their pages.
	const { pages } = getBoard();

	/** The page (id) or folder (`folder:<id>`) being renamed. */
	let renaming = $state<string | null>(null);
	let deleting = $state<string[]>([]);
	let confirmOpen = $state(false);
	let tablist = $state<HTMLElement>();
	/** The tab being dragged (its strip key) and the gap it would drop into. */
	let drag = $state<{ key: string; slot: number } | null>(null);
	let swallowClick = false;

	const items = $derived(stripItems(pages.units, pages.current));
	const visiblePages = $derived(items.flatMap((it) => (it.kind === 'page' ? [it.page] : [])));
	const mark = $derived.by(() => {
		if (!drag) return null;
		const { key, slot } = drag;
		if (key.startsWith('folder:'))
			return folderDrop(items, slot, key.slice(7)) === undefined ? null : slot;
		const page = pages.list.find((p) => p.id === key);
		return page && !isNoopPageDrop(items, slot, page) ? slot : null;
	});

	const deleteTitle = $derived(
		deleting.length === 1
			? `Delete “${pages.list.find((p) => p.id === deleting[0])?.name ?? ''}”?`
			: `Delete ${deleting.length} pages?`
	);

	function askDelete(ids: string[]) {
		deleting = ids;
		confirmOpen = true;
	}

	function drop(key: string, slot: number) {
		if (key.startsWith('folder:')) {
			const id = key.slice(7);
			const before = folderDrop(items, slot, id);
			if (before !== undefined) pages.moveFolder(id, before);
			return;
		}
		const page = pages.list.find((p) => p.id === key);
		if (!page || isNoopPageDrop(items, slot, page)) return;
		const to = pageDrop(items, slot, key);
		pages.place([key], to.before, to.folder);
	}

	function onDragStart(e: PointerEvent, key: string) {
		// Touch drags scroll the tab strip; touch users reorder from the menu.
		if (e.button !== 0 || e.pointerType === 'touch' || e.ctrlKey || e.metaKey || e.shiftKey) return;
		trackTabDrag(e, {
			tabs: () => [...(tablist?.querySelectorAll('[data-strip-item]') ?? [])],
			onMove: (slot) => (drag = { key, slot }),
			onEnd: (slot) => {
				drag = null;
				// The click that ends a drag must not switch pages or open a folder.
				swallowClick = true;
				setTimeout(() => (swallowClick = false));
				if (slot !== null) drop(key, slot);
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

	function onTabKeydown(e: KeyboardEvent, id: string) {
		const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
		if (step && (e.ctrlKey || e.metaKey) && e.shiftKey) {
			e.preventDefault();
			e.stopPropagation();
			pages.move(id, step);
			focusTab(id);
		} else if (step) {
			// Arrows go through the tabs on show: closed folders' pages are skipped.
			const i = visiblePages.findIndex((p) => p.id === id);
			const next = visiblePages[(i + step + visiblePages.length) % visiblePages.length];
			if (!next) return;
			e.preventDefault();
			pages.select(next.id);
			focusTab(next.id);
		} else if (e.key === 'F2') {
			e.preventDefault();
			renaming = id;
		}
	}
</script>

<div class="flex min-w-0 items-stretch">
	<div
		bind:this={tablist}
		{@attach scrollFade}
		role="tablist"
		aria-label="Pages"
		class="flex min-w-0 items-stretch overflow-x-auto"
	>
		{#each items as item, i (itemKey(item))}
			{#if mark === i}
				{@render dropMark()}
			{/if}
			{@const key = itemKey(item)}
			{#if renaming === key}
				<TabNameInput
					value={item.kind === 'page' ? item.page.name : item.folder.name}
					label={item.kind === 'page' ? 'Page name' : 'Folder name'}
					oncommit={(name) => {
						if (item.kind === 'page') pages.rename(item.page.id, name);
						else pages.renameFolder(item.folder.id, name);
						renaming = null;
					}}
					oncancel={() => (renaming = null)}
				/>
			{:else if item.kind === 'folder'}
				<FolderTab
					folder={item.folder}
					folderPages={item.pages}
					dragging={drag?.key === key}
					onrename={() => (renaming = key)}
					ondelete={askDelete}
					onpointerdown={(e) => onDragStart(e, key)}
					swallow={() => swallowClick}
				/>
			{:else}
				<PageTab
					page={item.page}
					dragging={drag?.key === key}
					onrename={() => (renaming = key)}
					ondelete={askDelete}
					onpointerdown={(e) => onDragStart(e, key)}
					onclick={(e) => onTabClick(e, item.page.id)}
					onkeydown={(e) => onTabKeydown(e, item.page.id)}
				/>
			{/if}
		{/each}
		{#if mark === items.length}
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
