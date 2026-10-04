<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import {
		deleteMessage,
		deleteThread,
		editMessage,
		reply,
		setResolved,
		type CommentThread
	} from '$lib/model/comments';
	import { getBoard } from '../context';
	import CommentComposer from './CommentComposer.svelte';
	import CommentMessageItem from './CommentMessageItem.svelte';

	let { thread, autofocus = false }: { thread: CommentThread; autofocus?: boolean } = $props();

	const ctx = getBoard();
	const quote = $derived(ctx.comments.quote(thread));
	/** Each action is its own undo step. */
	const step = (fn: () => void) => {
		ctx.undo.stopCapturing();
		fn();
		ctx.undo.stopCapturing();
	};
	const action =
		'inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted hover:bg-surface-2 hover:text-text pointer-coarse:h-11';
</script>

<section
	class="flex flex-col gap-2"
	aria-label="Comment thread"
	data-comment-thread={thread.id}
	data-resolved={thread.resolved ? '' : undefined}
>
	<div class="flex items-center gap-1">
		{#if thread.anchor.kind === 'text'}
			<blockquote
				class="min-w-0 flex-1 truncate border-l-2 border-accent pl-2 text-xs text-muted italic"
				data-comment-quote
			>
				{quote || 'The commented text was deleted'}
			</blockquote>
		{:else}
			<span class="flex-1"></span>
		{/if}
		{#if thread.resolved}
			<button
				type="button"
				class={action}
				onclick={() => step(() => setResolved(ctx.doc, thread.id, false))}
				><RotateCcw class="size-3.5" aria-hidden="true" />Reopen</button
			>
		{:else}
			<button
				type="button"
				class={action}
				onclick={() => step(() => setResolved(ctx.doc, thread.id, true))}
				><Check class="size-3.5" aria-hidden="true" />Resolve</button
			>
		{/if}
		<button
			type="button"
			class="{action} px-1.5"
			aria-label="Delete thread"
			onclick={() => step(() => deleteThread(ctx.doc, thread.id))}
			><Trash2 class="size-3.5" aria-hidden="true" /></button
		>
	</div>
	<ul class="flex flex-col gap-2.5">
		{#each thread.messages as m (m.id)}
			<CommentMessageItem
				message={m}
				onedit={(text) => step(() => editMessage(ctx.doc, thread.id, m.id, text))}
				ondelete={() => step(() => deleteMessage(ctx.doc, thread.id, m.id))}
			/>
		{/each}
	</ul>
	<CommentComposer
		label="Reply"
		submitLabel="Reply"
		{autofocus}
		onsubmit={(author, text) => step(() => reply(ctx.doc, thread.id, author, text))}
	/>
</section>
