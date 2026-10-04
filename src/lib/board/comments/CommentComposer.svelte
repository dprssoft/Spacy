<script lang="ts">
	import { commentAuthor } from './author.svelte';

	let {
		label,
		submitLabel,
		autofocus = false,
		onsubmit,
		oncancel
	}: {
		label: string;
		submitLabel: string;
		autofocus?: boolean;
		onsubmit: (author: string, text: string) => void;
		oncancel?: () => void;
	} = $props();

	let text = $state('');
	let name = $state(commentAuthor.name);
	// Asked once, the first time you comment; changed later in Settings.
	const askName = !commentAuthor.name;
	let nameInput = $state<HTMLInputElement>();

	function submit(e?: Event) {
		e?.preventDefault();
		if (!text.trim()) return;
		if (askName) {
			if (!name.trim()) {
				nameInput?.focus();
				return;
			}
			commentAuthor.set(name);
		}
		onsubmit(commentAuthor.name, text);
		text = '';
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(e);
	}

	const focusOnMount = (node: HTMLElement) => {
		if (autofocus) requestAnimationFrame(() => node.focus({ preventScroll: true }));
	};
	const field =
		'w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent pointer-coarse:text-base';
</script>

<form class="flex flex-col gap-2" onsubmit={submit} data-comment-composer>
	{#if askName}
		<input
			bind:this={nameInput}
			bind:value={name}
			class={field}
			maxlength="100"
			placeholder="Your name"
			aria-label="Your name (shown on your comments)"
			data-comment-name
		/>
	{/if}
	<textarea
		bind:value={text}
		class="{field} min-h-16 resize-y"
		rows="2"
		maxlength="10000"
		aria-label={label}
		placeholder={label}
		{onkeydown}
		{@attach focusOnMount}></textarea>
	<div class="flex justify-end gap-2">
		{#if oncancel}
			<button
				type="button"
				class="h-7 rounded-md px-2 text-xs text-muted hover:bg-surface-2 hover:text-text pointer-coarse:h-11"
				onclick={oncancel}>Cancel</button
			>
		{/if}
		<button
			type="submit"
			class="h-7 rounded-md bg-accent px-3 text-xs font-medium text-accent-contrast disabled:opacity-50 pointer-coarse:h-11"
			disabled={!text.trim()}>{submitLabel}</button
		>
	</div>
</form>
