<script lang="ts">
	import { getBoard } from '../context';
	import { openBacklink } from './backlinkNav';

	let { targetId, onpick }: { targetId: string; onpick?: () => void } = $props();

	const ctx = getBoard();
	const links = $derived(ctx.backlinks.of(targetId));
	// Titles can change after indexing: read the current one when the card is on this page.
	const title = (cardId: string, fallback: string) => {
		const el = ctx.store.get(cardId);
		return el?.type === 'doccard' ? el.title || 'Untitled' : fallback;
	};
</script>

<ul class="flex max-h-72 flex-col gap-1 overflow-y-auto" data-testid="backlinks">
	{#each links as link, i (link.cardId + i)}
		<li>
			<button
				type="button"
				class="w-full rounded-md px-2 py-1.5 text-left hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none pointer-coarse:py-3"
				onclick={() => {
					onpick?.();
					openBacklink(ctx, link.cardId, targetId);
				}}
			>
				<span class="block truncate text-sm font-medium">{title(link.cardId, link.cardTitle)}</span>
				<span class="block text-xs text-muted">{link.snippet}</span>
			</button>
		</li>
	{:else}
		<li class="px-2 py-1.5 text-xs text-muted">Not mentioned anywhere yet.</li>
	{/each}
</ul>
