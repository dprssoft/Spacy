<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { commentAuthor } from '$lib/board/comments/author.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	let name = $state('');
	$effect(() => {
		if (open) name = commentAuthor.name;
	});

	function save(e: Event) {
		e.preventDefault();
		commentAuthor.set(name);
		open = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/40" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-50 w-[min(92vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-6 shadow-xl"
		>
			<Dialog.Title class="text-base font-semibold">Your name for comments</Dialog.Title>
			<Dialog.Description class="mt-1 text-sm text-muted">
				Shown on comments you write from this browser.
			</Dialog.Description>
			<form class="mt-4 flex flex-col gap-4" onsubmit={save}>
				<input
					bind:value={name}
					class="h-9 rounded-md border border-border bg-surface px-2 text-sm outline-none focus:border-accent pointer-coarse:text-base"
					maxlength="100"
					aria-label="Your name"
					data-testid="comment-name-input"
				/>
				<div class="flex justify-end gap-2">
					<Dialog.Close class="h-9 rounded-lg px-4 text-sm hover:bg-surface-2">Cancel</Dialog.Close>
					<button
						type="submit"
						class="h-9 rounded-lg bg-accent px-4 text-sm font-medium text-accent-contrast"
						>Save</button
					>
				</div>
			</form>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
