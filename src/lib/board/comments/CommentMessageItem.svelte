<script lang="ts">
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import type { CommentMessage } from '$lib/model/comments';
	import { relativeTime } from '$lib/shared/relativeTime';

	let {
		message,
		onedit,
		ondelete
	}: {
		message: CommentMessage;
		onedit: (text: string) => void;
		ondelete: () => void;
	} = $props();

	let editing = $state(false);
	let draft = $state('');

	function save(e: Event) {
		e.preventDefault();
		if (draft.trim()) onedit(draft);
		editing = false;
	}
	const icon =
		'inline-flex size-6 items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-text pointer-coarse:size-9';
</script>

<li class="group flex flex-col gap-0.5" data-comment-message={message.id}>
	<div class="flex items-center gap-2 text-xs">
		<span class="font-semibold">{message.author || 'Anonymous'}</span>
		<time class="text-muted" datetime={new Date(message.at).toISOString()}
			>{relativeTime(message.at)}{message.editedAt ? ' · edited' : ''}</time
		>
		{#if !editing}
			<span
				class="ml-auto flex opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
			>
				<button
					type="button"
					class={icon}
					aria-label="Edit comment"
					title="Edit"
					onclick={() => {
						draft = message.text;
						editing = true;
					}}><Pencil class="size-3.5" aria-hidden="true" /></button
				>
				<button
					type="button"
					class={icon}
					aria-label="Delete comment"
					title="Delete"
					onclick={ondelete}><Trash2 class="size-3.5" aria-hidden="true" /></button
				>
			</span>
		{/if}
	</div>
	{#if editing}
		<form class="flex flex-col gap-1.5" onsubmit={save}>
			<textarea
				bind:value={draft}
				class="min-h-14 w-full resize-y rounded-md border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent pointer-coarse:text-base"
				aria-label="Edit comment"
				data-own-escape
				maxlength="10000"
				onkeydown={(e) => {
					if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save(e);
					if (e.key === 'Escape') {
						e.stopPropagation();
						editing = false;
					}
				}}></textarea>
			<div class="flex justify-end gap-2">
				<button
					type="button"
					class="h-7 rounded-md px-2 text-xs text-muted hover:bg-surface-2 pointer-coarse:h-11"
					onclick={() => (editing = false)}>Cancel</button
				>
				<button
					type="submit"
					class="h-7 rounded-md bg-accent px-3 text-xs font-medium text-accent-contrast pointer-coarse:h-11"
					>Save</button
				>
			</div>
		</form>
	{:else}
		<p class="text-sm break-words whitespace-pre-wrap">{message.text}</p>
	{/if}
</li>
