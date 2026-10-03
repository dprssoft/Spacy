<script lang="ts">
	import { getBoard } from '../context';
	import PageTabs from './PageTabs.svelte';
	import ZoomControls from './ZoomControls.svelte';

	const ctx = getBoard();
	const count = $derived(ctx.store.elements.size);
	const selected = $derived(ctx.selection.size);
	const words = $derived(ctx.words.words(selected > 0 ? ctx.selection.ids : undefined));
</script>

<!-- Like a spreadsheet's bottom bar: page tabs on the left, status and zoom on the right. -->
<footer
	class="flex h-8 shrink-0 items-stretch gap-2 border-t border-border bg-surface-2 pr-1 text-xs max-sm:gap-1 pointer-coarse:h-11"
	data-interactive
>
	<PageTabs />
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
