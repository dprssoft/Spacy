<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Maximize2 from '@lucide/svelte/icons/maximize-2';
	import CornerUpLeft from '@lucide/svelte/icons/corner-up-left';
	import { Popover } from 'bits-ui';
	import BacklinksList from '../../writing/BacklinksList.svelte';
	import { DOC_CARD_HEADER_H } from '$lib/model/defaults';
	import { updateElement } from '$lib/model/ops';
	import type { DocCardElement } from '$lib/model/types';
	import { getBoard } from '../../context';
	import DocCardMenu from '../../doccards/DocCardMenu.svelte';
	import { setCollapsed } from './collapse';

	let { el, editingTitle, onopen }: { el: DocCardElement; editingTitle: boolean; onopen(): void } =
		$props();

	const ctx = getBoard();
	const backlinks = $derived(ctx.backlinks.of(el.id));
	let draft = $state('');
	let cancelled = false;

	function focusTitle(node: HTMLInputElement) {
		draft = el.title;
		cancelled = false;
		node.focus();
		node.select();
	}

	function commit() {
		const title = draft.trim();
		if (!cancelled && title && title !== el.title) updateElement(ctx.doc, el.id, { title });
		ctx.editing.end();
	}
</script>

<div
	class="flex shrink-0 items-center gap-1 border-b px-3"
	data-doccard-header
	style:height="{DOC_CARD_HEADER_H}px"
	style:border-color={el.collapsed
		? 'transparent'
		: 'color-mix(in srgb, currentColor 12%, transparent)'}
>
	<button
		type="button"
		class="pointer-events-auto -ml-1.5 inline-flex size-6 shrink-0 items-center justify-center rounded opacity-60 hover:bg-black/5 hover:opacity-100"
		aria-label={el.collapsed ? 'Expand doc card' : 'Collapse doc card'}
		title={el.collapsed ? 'Expand' : 'Collapse'}
		aria-expanded={!el.collapsed}
		data-interactive
		onpointerdown={(e) => e.stopPropagation()}
		onclick={() => setCollapsed(ctx, el, !el.collapsed)}
	>
		{#if el.collapsed}
			<ChevronRight class="size-4" aria-hidden="true" />
		{:else}
			<ChevronDown class="size-4" aria-hidden="true" />
		{/if}
	</button>
	{#if editingTitle}
		<input
			{@attach focusTitle}
			bind:value={draft}
			aria-label="Doc card title"
			data-interactive
			class="pointer-events-auto min-w-0 flex-1 rounded border border-accent bg-transparent px-1 font-semibold outline-none"
			onblur={commit}
			onkeydown={(e) => {
				e.stopPropagation();
				if (e.key === 'Enter') commit();
				if (e.key === 'Escape') {
					cancelled = true;
					commit();
				}
			}}
		/>
	{:else}
		<div class="min-w-0 truncate px-1 font-semibold" data-doccard-title>{el.title}</div>
		<div class="flex-1"></div>
	{/if}
	{#if backlinks.length > 0}
		<Popover.Root>
			<Popover.Trigger
				class="pointer-events-auto inline-flex h-6 shrink-0 items-center gap-0.5 rounded px-1 text-xs opacity-60 hover:bg-black/5 hover:opacity-100"
				aria-label="Mentioned in {backlinks.length} {backlinks.length === 1 ? 'card' : 'cards'}"
				title="Mentioned in {backlinks.length} {backlinks.length === 1 ? 'card' : 'cards'}"
				data-interactive
				data-testid="backlinks-badge"
				onpointerdown={(e: PointerEvent) => e.stopPropagation()}
			>
				<CornerUpLeft class="size-3.5" aria-hidden="true" />{backlinks.length}
			</Popover.Trigger>
			<Popover.Portal>
				<Popover.Content
					side="bottom"
					align="end"
					sideOffset={6}
					data-interactive
					class="z-50 w-80 rounded-xl border border-border bg-surface p-2 text-text shadow-lg"
				>
					<p class="px-2 pb-1 text-xs font-semibold text-muted">Mentioned in</p>
					<BacklinksList targetId={el.id} />
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	{/if}
	<DocCardMenu
		cardId={el.id}
		class="pointer-events-auto inline-flex size-6 shrink-0 items-center justify-center rounded opacity-60 hover:bg-black/5 hover:opacity-100"
	/>
	<button
		type="button"
		class="pointer-events-auto -mr-1.5 inline-flex size-6 shrink-0 items-center justify-center rounded opacity-60 hover:bg-black/5 hover:opacity-100"
		aria-label="Open in focus mode"
		title="Open (Ctrl/⌘+Enter)"
		data-interactive
		onpointerdown={(e) => e.stopPropagation()}
		onclick={onopen}
	>
		<Maximize2 class="size-3.5" aria-hidden="true" />
	</button>
</div>
