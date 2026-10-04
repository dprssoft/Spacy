<script lang="ts">
	import { getBoard } from '../context';
	import ListTree from '@lucide/svelte/icons/list-tree';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import PageTabs from './PageTabs.svelte';
	import ZoomControls from './ZoomControls.svelte';

	const ctx = getBoard();
	const count = $derived(ctx.store.elements.size);
	const selected = $derived(ctx.selection.size);
	const openComments = $derived(ctx.comments.onPage.filter((t) => !t.resolved).length);
	const words = $derived(ctx.words.words(selected > 0 ? ctx.selection.ids : undefined));
</script>

<!-- Like a spreadsheet's bottom bar: page tabs on the left, status and zoom on the right. -->
<footer
	class="flex h-8 shrink-0 items-stretch gap-2 border-t border-border bg-surface-2 pr-1 text-xs max-sm:gap-1 pointer-coarse:h-11"
	data-interactive
>
	<PageTabs />
	<button
		type="button"
		class="inline-flex shrink-0 items-center gap-1.5 self-center rounded-md px-2 py-1 text-muted hover:bg-surface hover:text-text aria-pressed:text-accent pointer-coarse:min-h-11"
		aria-pressed={ctx.outline.open}
		aria-keyshortcuts="Control+Shift+O"
		title="Outline (Mod+Shift+O)"
		data-testid="outline-toggle"
		onclick={() => ctx.outline.toggle()}
	>
		<ListTree class="size-4" aria-hidden="true" /><span class="max-sm:sr-only">Outline</span>
	</button>
	<button
		type="button"
		class="inline-flex shrink-0 items-center gap-1.5 self-center rounded-md px-2 py-1 text-muted hover:bg-surface hover:text-text aria-pressed:text-accent pointer-coarse:min-h-11"
		aria-pressed={ctx.comments.panelOpen}
		title="Comments"
		data-testid="comments-toggle"
		onclick={() => ctx.comments.togglePanel()}
	>
		<MessageSquare class="size-4" aria-hidden="true" /><span class="max-sm:sr-only">Comments</span>
		{#if openComments > 0}<span class="tabular-nums" data-testid="comments-count"
				>{openComments}</span
			>{/if}
	</button>
	<p
		class="ml-auto hidden shrink-0 items-center px-2 text-muted sm:flex"
		data-testid="status-count"
	>
		{selected > 0
			? `${selected} of ${count} selected`
			: `${count} ${count === 1 ? 'object' : 'objects'}`}
	</p>
	{#if words > 0}
		<p class="hidden shrink-0 items-center pr-2 text-muted sm:flex" data-testid="status-words">
			{words.toLocaleString('en')}
			{words === 1 ? 'word' : 'words'}
		</p>
	{/if}
	<div class="flex items-center max-sm:ml-auto">
		<ZoomControls viewport={ctx.viewport} contentBounds={() => ctx.store.contentBounds()} />
	</div>
</footer>
