<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import type { CommentThread } from '$lib/model/comments';
	import { getBoard } from '../context';
	import { jumpToElement } from '../doccards/jumpTo';
	import { targetOf, type CommentFilter } from './commentsState.svelte';
	import { targetLabel } from './labels';

	const ctx = getBoard();
	const { comments } = ctx;
	const all = $derived(comments.onPage);
	const counts = $derived({
		open: all.filter((t) => !t.resolved).length,
		resolved: all.filter((t) => t.resolved).length
	});
	const shown = $derived(all.filter((t) => t.resolved === (comments.filter === 'resolved')));
	const FILTERS: { value: CommentFilter; label: string }[] = [
		{ value: 'open', label: 'Open' },
		{ value: 'resolved', label: 'Resolved' }
	];

	function show(t: CommentThread) {
		if (!jumpToElement(ctx, targetOf(t))) return;
		// After the view starts flying: the popover follows its object.
		requestAnimationFrame(() => comments.openThread(t.id));
	}
</script>

<aside
	aria-label="Comments"
	data-interactive
	data-testid="comments-panel"
	class="flex h-full min-h-0 w-72 shrink-0 flex-col border-l border-border bg-surface text-sm max-sm:w-full max-sm:border-l-0"
>
	<header class="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
		<h2 class="font-semibold">Comments</h2>
		<button
			type="button"
			class="ml-auto inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text pointer-coarse:size-11"
			aria-label="Close comments panel"
			onclick={() => comments.togglePanel()}
		>
			<X class="size-4" aria-hidden="true" />
		</button>
	</header>
	<div class="flex shrink-0 gap-1 border-b border-border p-2" role="group" aria-label="Show">
		{#each FILTERS as f (f.value)}
			<button
				type="button"
				class="h-7 flex-1 rounded-md text-xs text-muted hover:bg-surface-2 aria-pressed:bg-accent/15 aria-pressed:text-accent pointer-coarse:h-11"
				aria-pressed={comments.filter === f.value}
				data-comments-filter={f.value}
				onclick={() => (comments.filter = f.value)}>{f.label} ({counts[f.value]})</button
			>
		{/each}
	</div>
	<ul class="min-h-0 flex-1 overflow-y-auto p-2">
		{#each shown as t (t.id)}
			{@const el = ctx.store.get(targetOf(t))}
			{@const first = t.messages[0]}
			<li>
				<button
					type="button"
					class="flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-surface-2"
					data-comments-row={t.id}
					onclick={() => show(t)}
				>
					<span class="truncate text-xs text-muted">{el ? targetLabel(el) : ''}</span>
					{#if t.anchor.kind === 'text'}
						<span class="truncate border-l-2 border-accent pl-1.5 text-xs italic"
							>{comments.quote(t) || 'The commented text was deleted'}</span
						>
					{/if}
					{#if first}
						<span class="line-clamp-2"
							><span class="font-semibold">{first.author || 'Anonymous'}:</span> {first.text}</span
						>
					{/if}
					{#if t.messages.length > 1}
						<span class="text-xs text-muted"
							>{t.messages.length - 1}
							{t.messages.length === 2 ? 'reply' : 'replies'}</span
						>
					{/if}
				</button>
			</li>
		{:else}
			<li class="px-2 py-6 text-center text-xs text-muted">
				{comments.filter === 'open' ? 'No open comments on this page' : 'No resolved comments'}
			</li>
		{/each}
	</ul>
</aside>
