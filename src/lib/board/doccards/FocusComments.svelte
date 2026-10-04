<script lang="ts">
	import { getBoard } from '../context';

	// Focus mode: the card's open text comments in the right margin.
	let { cardId, class: className = '' }: { cardId: string; class?: string } = $props();

	const ctx = getBoard();
	const threads = $derived(
		ctx.comments.threads.filter(
			(t) => !t.resolved && t.anchor.kind === 'text' && t.anchor.cardId === cardId
		)
	);

	function show(id: string) {
		document
			.querySelector(`[data-focus-body] [data-comment="${CSS.escape(id)}"]`)
			?.scrollIntoView({ block: 'center' });
		requestAnimationFrame(() => ctx.comments.openThread(id));
	}
</script>

{#if threads.length > 0}
	<section
		class="absolute top-28 right-3 flex max-h-[60dvh] w-64 flex-col gap-1 overflow-y-auto rounded-xl border border-border bg-surface p-2 shadow max-xl:hidden {className}"
		aria-label="Comments"
		data-focus-comments
	>
		<p class="px-2 pb-1 text-xs font-semibold text-muted">Comments</p>
		{#each threads as t (t.id)}
			<button
				type="button"
				class="flex flex-col gap-0.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2"
				onclick={() => show(t.id)}
			>
				<span class="truncate border-l-2 border-accent pl-1.5 text-xs text-muted italic"
					>{ctx.comments.quote(t) || 'The commented text was deleted'}</span
				>
				<span class="line-clamp-2"
					><span class="font-semibold">{t.messages[0]?.author || 'Anonymous'}:</span>
					{t.messages[0]?.text}</span
				>
				{#if t.messages.length > 1}
					<span class="text-xs text-muted"
						>{t.messages.length - 1} {t.messages.length === 2 ? 'reply' : 'replies'}</span
					>
				{/if}
			</button>
		{/each}
	</section>
{/if}
