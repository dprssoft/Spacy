<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import type { Page } from '$lib/model/pages';
	import { getBoard } from '../context';
	import { menuContent, menuItem } from './tabMenu';

	interface Props {
		page: Page;
		dragging: boolean;
		onrename: () => void;
		ondelete: (ids: string[]) => void;
		onpointerdown: (e: PointerEvent) => void;
		onclick: (e: MouseEvent) => void;
		onkeydown: (e: KeyboardEvent) => void;
	}
	let { page, dragging, onrename, ondelete, onpointerdown, onclick, onkeydown }: Props = $props();
	const { pages } = getBoard();

	let open = $state(false);
	const active = $derived(page.id === pages.current);
	const picked = $derived(pages.picked.includes(page.id));
	const targets = $derived(open ? pages.targets(page.id) : [page.id]);
	const many = $derived(targets.length > 1);
	const unitIndex = $derived(
		pages.units.findIndex((u) => u.kind === 'page' && u.page.id === page.id)
	);
	const otherFolders = $derived(pages.folders.filter((f) => f.id !== page.folder));
	const inFolder = $derived(targets.some((id) => pages.list.find((p) => p.id === id)?.folder));

	function openMenu() {
		// Opening the menu on a picked tab keeps the others picked.
		if (!pages.selectedIds.includes(page.id)) pages.select(page.id);
		open = true;
	}
</script>

<DropdownMenu.Root bind:open>
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
				data-strip-item
				data-in-folder={page.folder ? '' : undefined}
				data-picked={picked || undefined}
				data-dragging={dragging || undefined}
				title="{page.name} — double-click to rename, drag to reorder, right-click for more, Ctrl-click to pick several"
				class="max-w-40 shrink-0 truncate border-r border-border px-3 text-xs whitespace-nowrap text-muted hover:bg-surface hover:text-text focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none focus-visible:ring-inset aria-selected:bg-surface aria-selected:font-medium aria-selected:text-text aria-selected:shadow-[inset_0_-2px_0_var(--accent)] data-[dragging]:opacity-50 data-[in-folder]:bg-text/6 data-[in-folder]:shadow-[inset_0_2px_0_color-mix(in_srgb,var(--muted)_50%,transparent)] data-[in-folder]:aria-selected:shadow-[inset_0_-2px_0_var(--accent)] data-[picked]:bg-surface data-[picked]:text-text data-[picked]:shadow-[inset_0_-2px_0_var(--muted)]"
				{onpointerdown}
				{onclick}
				ondblclick={onrename}
				oncontextmenu={(e) => {
					e.preventDefault();
					openMenu();
				}}
				onkeydown={(e) => {
					if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
						e.preventDefault();
						openMenu();
					} else onkeydown(e);
				}}
			>
				{page.name}
			</button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Portal>
		<DropdownMenu.Content side="top" align="start" sideOffset={4} class={menuContent}>
			<DropdownMenu.Item class={menuItem} disabled={many} onSelect={onrename}
				>Rename</DropdownMenu.Item
			>
			<DropdownMenu.Item
				class={menuItem}
				onSelect={() => {
					for (const id of targets) pages.duplicate(id);
				}}
			>
				{many ? `Duplicate ${targets.length} pages` : 'Duplicate'}
			</DropdownMenu.Item>
			<DropdownMenu.Item
				class={menuItem}
				disabled={many || unitIndex === 0}
				onSelect={() => pages.move(page.id, -1)}
			>
				Move left
			</DropdownMenu.Item>
			<DropdownMenu.Item
				class={menuItem}
				disabled={many || unitIndex === pages.units.length - 1}
				onSelect={() => pages.move(page.id, 1)}
			>
				Move right
			</DropdownMenu.Item>
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger class={menuItem}>Move to folder</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent class={menuContent}>
					<DropdownMenu.Item class={menuItem} onSelect={() => pages.group(targets)}>
						New folder
					</DropdownMenu.Item>
					{#each otherFolders as folder (folder.id)}
						<DropdownMenu.Item
							class={menuItem}
							onSelect={() => pages.moveToFolder(targets, folder.id)}
						>
							{folder.name}
						</DropdownMenu.Item>
					{/each}
					{#if inFolder}
						<DropdownMenu.Separator class="my-1 h-px bg-border" />
						<DropdownMenu.Item class={menuItem} onSelect={() => pages.moveToFolder(targets, null)}>
							Remove from folder
						</DropdownMenu.Item>
					{/if}
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
			<DropdownMenu.Separator class="my-1 h-px bg-border" />
			<DropdownMenu.Item
				class="{menuItem} text-danger"
				disabled={targets.length >= pages.list.length}
				onSelect={() => ondelete(targets)}
			>
				{many ? `Delete ${targets.length} pages` : 'Delete'}
			</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>
