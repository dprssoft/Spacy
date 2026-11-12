<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Folder from '@lucide/svelte/icons/folder';
	import type { Page, PageFolder } from '$lib/model/pages';
	import { getBoard } from '../context';
	import { menuContent, menuItem } from './tabMenu';

	interface Props {
		folder: PageFolder;
		folderPages: Page[];
		dragging: boolean;
		onrename: () => void;
		ondelete: (ids: string[]) => void;
		onpointerdown: (e: PointerEvent) => void;
		/** Whether the click ends a drag (and so mustn't open or close the folder). */
		swallow: () => boolean;
	}
	let { folder, folderPages, dragging, onrename, ondelete, onpointerdown, swallow }: Props =
		$props();
	const { pages } = getBoard();

	let open = $state(false);
	const holdsCurrent = $derived(folderPages.some((p) => p.id === pages.current));
	const count = $derived(folderPages.length === 1 ? '1 page' : `${folderPages.length} pages`);
</script>

<DropdownMenu.Root bind:open>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<!-- A tab of the tab list that opens and closes the folder instead of showing a page. -->
			<button
				{...props}
				type="button"
				role="tab"
				aria-selected="false"
				aria-expanded={!folder.collapsed}
				aria-haspopup="menu"
				aria-label="{folder.name}, folder, {count}"
				tabindex="-1"
				data-folder-tab={folder.id}
				data-strip-item
				data-holds-current={(folder.collapsed && holdsCurrent) || undefined}
				data-dragging={dragging || undefined}
				title="{folder.name} — click to {folder.collapsed
					? 'open'
					: 'close'}, double-click to rename, drag to reorder, right-click for more"
				class="inline-flex max-w-44 shrink-0 items-center gap-1 border-r border-border bg-text/6 pr-3 pl-2 text-xs font-medium whitespace-nowrap text-text shadow-[inset_0_2px_0_color-mix(in_srgb,var(--muted)_50%,transparent)] hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none focus-visible:ring-inset data-[dragging]:opacity-50 data-[holds-current]:shadow-[inset_0_-2px_0_var(--accent)]"
				{onpointerdown}
				onclick={() => {
					if (!swallow()) pages.toggleFolder(folder.id);
				}}
				ondblclick={onrename}
				oncontextmenu={(e) => {
					e.preventDefault();
					open = true;
				}}
				onkeydown={(e) => {
					if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
						e.preventDefault();
						open = true;
					} else if (e.key === 'F2') {
						e.preventDefault();
						onrename();
					}
				}}
			>
				<ChevronRight
					class="size-3.5 shrink-0 text-muted transition-transform motion-reduce:transition-none {folder.collapsed
						? ''
						: 'rotate-90'}"
					aria-hidden="true"
				/>
				<Folder class="size-3.5 shrink-0 text-muted" aria-hidden="true" />
				<span class="truncate">{folder.name}</span>
				<span
					class="rounded-full bg-surface-2 px-1.5 text-[10px] leading-4 font-normal text-muted"
					aria-hidden="true">{folderPages.length}</span
				>
			</button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Portal>
		<DropdownMenu.Content side="top" align="start" sideOffset={4} class={menuContent}>
			<DropdownMenu.Item class={menuItem} onSelect={onrename}>Rename folder</DropdownMenu.Item>
			<DropdownMenu.Item
				class={menuItem}
				onSelect={() => {
					if (folder.collapsed) pages.toggleFolder(folder.id);
					pages.add(folderPages.at(-1)?.id);
				}}
			>
				New page in folder
			</DropdownMenu.Item>
			<DropdownMenu.Item class={menuItem} onSelect={() => pages.ungroup(folder.id)}>
				Ungroup
			</DropdownMenu.Item>
			<DropdownMenu.Separator class="my-1 h-px bg-border" />
			<DropdownMenu.Item
				class="{menuItem} text-danger"
				disabled={folderPages.length >= pages.list.length}
				onSelect={() => ondelete(folderPages.map((p) => p.id))}
			>
				Delete folder and its pages
			</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>
