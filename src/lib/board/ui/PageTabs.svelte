<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import Plus from '@lucide/svelte/icons/plus';
	import { MAX_PAGE_NAME } from '$lib/model/pages';
	import ConfirmDialog from '$lib/shared/ui/ConfirmDialog.svelte';
	import { getBoard } from '../context';

	// Sheet tabs: click to switch, double-click to rename, right-click (or the menu key) for more.
	const { pages } = getBoard();

	let renaming = $state<string | null>(null);
	let draft = $state('');
	let menuFor = $state<string | null>(null);
	let deleting = $state<string | null>(null);
	let confirmOpen = $state(false);

	const deletingName = $derived(pages.list.find((p) => p.id === deleting)?.name ?? '');

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

	function onTabKeydown(e: KeyboardEvent, index: number) {
		const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
		if (step) {
			const next = pages.list[(index + step + pages.list.length) % pages.list.length];
			if (!next) return;
			e.preventDefault();
			pages.select(next.id);
			queueMicrotask(() =>
				document.querySelector<HTMLElement>(`[data-page-tab="${next.id}"]`)?.focus()
			);
		} else if (e.key === 'F2') {
			e.preventDefault();
			startRename(pages.list[index]!.id);
		}
	}

	const item =
		'flex h-8 cursor-default items-center rounded-md px-2 text-sm outline-none select-none data-[disabled]:opacity-40 data-[highlighted]:bg-surface-2';
</script>

<div class="flex min-w-0 items-stretch">
	<div role="tablist" aria-label="Pages" class="flex min-w-0 items-stretch overflow-x-auto">
		{#each pages.list as page, i (page.id)}
			{@const active = page.id === pages.current}
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
								title="{page.name} — double-click to rename, right-click for more"
								class="max-w-40 shrink-0 truncate border-r border-border px-3 text-xs whitespace-nowrap text-muted hover:bg-surface hover:text-text focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none focus-visible:ring-inset aria-selected:bg-surface aria-selected:font-medium aria-selected:text-text aria-selected:shadow-[inset_0_-2px_0_var(--accent)]"
								onpointerdown={undefined}
								onclick={() => pages.select(page.id)}
								ondblclick={() => startRename(page.id)}
								oncontextmenu={(e) => {
									e.preventDefault();
									pages.select(page.id);
									menuFor = page.id;
								}}
								onkeydown={(e) => {
									if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
										e.preventDefault();
										menuFor = page.id;
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
							<DropdownMenu.Item class={item} onSelect={() => startRename(page.id)}>
								Rename
							</DropdownMenu.Item>
							<DropdownMenu.Item
								class={item}
								disabled={i === 0}
								onSelect={() => pages.move(page.id, -1)}
							>
								Move left
							</DropdownMenu.Item>
							<DropdownMenu.Item
								class={item}
								disabled={i === pages.list.length - 1}
								onSelect={() => pages.move(page.id, 1)}
							>
								Move right
							</DropdownMenu.Item>
							<DropdownMenu.Separator class="my-1 h-px bg-border" />
							<DropdownMenu.Item
								class="{item} text-danger"
								disabled={pages.list.length <= 1}
								onSelect={() => {
									deleting = page.id;
									confirmOpen = true;
								}}
							>
								Delete
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Portal>
				</DropdownMenu.Root>
			{/if}
		{/each}
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

<ConfirmDialog
	bind:open={confirmOpen}
	title="Delete “{deletingName}”?"
	description="Everything on this page is deleted. This can’t be undone, and it clears the undo history."
	confirmLabel="Delete page"
	danger
	onConfirm={() => {
		if (deleting) pages.remove(deleting);
		deleting = null;
	}}
/>
