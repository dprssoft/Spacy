<script lang="ts">
	import { ContextMenu } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import { stackableFrame, stackContents } from '../commands/arrange';
	import { copyToClipboard, pasteFromClipboard } from '../commands/clipboard';
	import {
		canGroup,
		canUngroup,
		deleteSelection,
		duplicateSelection,
		groupSelection,
		reorderSelection,
		selectedElements,
		toggleLock,
		ungroupSelection
	} from '../commands/edit';
	import { updateElements } from '$lib/model/ops';
	import { getBoard } from '../context';
	import { danglingConnectors } from '../diagram/ops';
	import { connectedComponent } from '../diagram/quickCreate';
	import { copyMarkdown, downloadMarkdown } from '../doccards/exportMarkdown';
	import { copyImage } from '../render/exportImage';
	import { exportDialog } from './exportDialogState.svelte';
	import { backlinksDialog } from '../writing/backlinksDialogState.svelte';
	import { formatKeys } from '../tools/formatKeys';
	import { isAssetTooLarge } from '$lib/storage/sync/assetFlags';
	import { wheelFromSelection } from '../widgets/create';
	import { selectedTexts } from '../widgets/selectionText';

	let { children }: { children: Snippet } = $props();

	const ctx = getBoard();

	// Recomputed each time the menu opens (selection is updated by the right-click first).
	let open = $state(false);
	const hasSelection = $derived(open && ctx.selection.size > 0);
	const allLocked = $derived(open && selectedElements(ctx).every((el) => el.locked));
	const stackFrame = $derived(open ? stackableFrame(ctx) : null);
	const mentionedIn = $derived(
		open && ctx.selection.single ? ctx.backlinks.of(ctx.selection.single).length : 0
	);
	const widget = $derived.by(() => {
		const el = open && ctx.selection.single ? ctx.store.get(ctx.selection.single) : undefined;
		return el?.type === 'widget' ? el : null;
	});
	const media = $derived.by(() => {
		const el = open && ctx.selection.single ? ctx.store.get(ctx.selection.single) : undefined;
		return el?.type === 'media' ? el : null;
	});
	const image = $derived.by(() => {
		const el = open && ctx.selection.single ? ctx.store.get(ctx.selection.single) : undefined;
		return el?.type === 'image' ? el : null;
	});
	let imageTooLarge = $state(false);
	$effect(() => {
		const assetId = image?.assetId;
		imageTooLarge = false;
		if (!assetId) return;
		let alive = true;
		void isAssetTooLarge(assetId)
			.catch(() => false)
			.then((v) => {
				if (alive) imageTooLarge = v;
			});
		return () => {
			alive = false;
		};
	});
	const docCard = $derived.by(() => {
		const id = open ? ctx.selection.single : null;
		return id && ctx.store.get(id)?.type === 'doccard' ? id : null;
	});

	const item =
		'flex h-8 pointer-coarse:h-11 cursor-default items-center justify-between gap-8 rounded-md px-2 text-sm outline-none select-none data-[disabled]:opacity-40 data-[highlighted]:bg-surface-2';
	const sep = 'my-1 h-px bg-border';
</script>

{#snippet entry(label: string, keys: string | null, run: () => void, disabled = false)}
	<ContextMenu.Item class={item} {disabled} onSelect={run}>
		<span>{label}</span>
		{#if keys}<kbd class="font-sans text-xs text-muted">{formatKeys(keys)}</kbd>{/if}
	</ContextMenu.Item>
{/snippet}

<ContextMenu.Root bind:open>
	<ContextMenu.Trigger class="block h-full w-full">
		{@render children()}
	</ContextMenu.Trigger>
	<ContextMenu.Portal>
		<ContextMenu.Content
			class="z-50 min-w-56 rounded-lg border border-border bg-surface p-1 shadow-lg"
			data-interactive
		>
			{#if hasSelection}
				{@render entry('Cut', 'Mod+X', () => copyToClipboard(ctx, true))}
				{@render entry('Copy', 'Mod+C', () => copyToClipboard(ctx))}
				{@render entry(
					'Copy as image',
					'Mod+Shift+C',
					() => void copyImage(ctx, { kind: 'selection' }, 2, '#ffffff')
				)}
				{@render entry('Paste', 'Mod+V', () => pasteFromClipboard(ctx))}
				{@render entry('Duplicate', 'Mod+D', () => duplicateSelection(ctx))}
				{@render entry('Delete', 'Delete', () => deleteSelection(ctx), allLocked)}
				<ContextMenu.Separator class={sep} />
				{@render entry('Bring to front', 'Mod+]', () => reorderSelection(ctx, 'front'))}
				{@render entry('Bring forward', ']', () => reorderSelection(ctx, 'forward'))}
				{@render entry('Send backward', '[', () => reorderSelection(ctx, 'backward'))}
				{@render entry('Send to back', 'Mod+[', () => reorderSelection(ctx, 'back'))}
				<ContextMenu.Separator class={sep} />
				{#if canUngroup(ctx)}
					{@render entry('Ungroup', 'Mod+Shift+G', () => ungroupSelection(ctx))}
				{/if}
				{#if canGroup(ctx)}
					{@render entry('Group', 'Mod+G', () => groupSelection(ctx))}
				{/if}
				{@render entry(allLocked ? 'Unlock' : 'Lock', 'Mod+Shift+L', () => toggleLock(ctx))}
				<ContextMenu.Separator class={sep} />
				{#if selectedElements(ctx).some((el) => el.type === 'connector' && el.waypoints.length > 0)}
					{@render entry('Reset route', null, () =>
						updateElements(
							ctx.doc,
							selectedElements(ctx)
								.filter((el) => el.type === 'connector')
								.map((el) => ({ id: el.id, patch: { waypoints: [] } }))
						)
					)}
				{/if}
				{#if stackFrame}
					{@render entry('Stack contents', null, () => stackContents(ctx, stackFrame))}
				{/if}
				{@render entry('Select connected', 'Mod+Shift+A', () =>
					ctx.selection.set(connectedComponent(ctx, ctx.selection.ids))
				)}
				{#if selectedTexts(ctx).length >= 2}
					{@render entry('Make a wheel from selection', null, () => wheelFromSelection(ctx))}
				{/if}
				<ContextMenu.Separator class={sep} />
				{#if ctx.selection.single}
					{@render entry('Comment', 'Mod+Alt+M', () =>
						ctx.comments.openElement(ctx.selection.single!)
					)}
				{/if}
				{@render entry('Export selection…', null, () => exportDialog.show('png', 'selection'))}
				{#if mentionedIn > 0}
					{@render entry(
						`Mentioned in ${mentionedIn}…`,
						null,
						() => (backlinksDialog.targetId = ctx.selection.single)
					)}
				{/if}
				{#if widget}
					<ContextMenu.Separator class={sep} />
					{@render entry('Widget settings', 'Shift+Enter', () =>
						ctx.widgets.openSettings(widget.id)
					)}
				{/if}
				{#if media}
					<ContextMenu.Separator class={sep} />
					{@render entry(ctx.playback.playing.has(media.id) ? 'Stop' : 'Play', null, () =>
						ctx.playback.toggle(media.id)
					)}
					{@render entry('Open link', null, () =>
						window.open(media.url, '_blank', 'noopener,noreferrer')
					)}
					{@render entry('Copy link', null, () => void navigator.clipboard?.writeText(media.url))}
				{/if}
				{#if imageTooLarge}
					<ContextMenu.Separator class={sep} />
					{@render entry('Not synced (too large)', null, () => {}, true)}
				{/if}
				{#if docCard}
					<ContextMenu.Separator class={sep} />
					{@render entry('Copy as Markdown', null, () => copyMarkdown(ctx, docCard))}
					{@render entry('Download .md', null, () => downloadMarkdown(ctx, docCard))}
					{#if ctx.comments.threads.some((t) => t.anchor.kind === 'text' && t.anchor.cardId === docCard)}
						{@render entry('Download .md with comments', null, () =>
							downloadMarkdown(ctx, docCard, { comments: true })
						)}
					{/if}
				{/if}
			{:else}
				{@render entry('Paste', 'Mod+V', () => pasteFromClipboard(ctx))}
				{@render entry('Select all', 'Mod+A', () =>
					ctx.selection.set(
						[...ctx.store.elements.values()].filter((el) => !el.locked).map((el) => el.id)
					)
				)}
				{@render entry('Zoom to fit', 'Shift+1', () => ctx.viewport.fit(ctx.store.contentBounds()))}
				{@render entry('Select dangling connectors', null, () =>
					ctx.selection.set(danglingConnectors(ctx.store.elements.values()))
				)}
			{/if}
		</ContextMenu.Content>
	</ContextMenu.Portal>
</ContextMenu.Root>
