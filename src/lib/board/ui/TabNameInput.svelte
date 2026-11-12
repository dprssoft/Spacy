<script lang="ts">
	import { MAX_PAGE_NAME } from '$lib/model/pages';

	interface Props {
		value: string;
		label: string;
		oncommit: (name: string) => void;
		oncancel: () => void;
	}
	let { value, label, oncommit, oncancel }: Props = $props();
	// Starts from the name at the time renaming began; later outside renames don't reset typing.
	// svelte-ignore state_referenced_locally
	let draft = $state(value);
	let done = false;

	function focusAndSelect(node: HTMLInputElement) {
		node.focus();
		node.select();
	}
	function finish(commit: boolean) {
		if (done) return;
		done = true;
		if (commit) oncommit(draft);
		else oncancel();
	}
</script>

<input
	{@attach focusAndSelect}
	bind:value={draft}
	maxlength={MAX_PAGE_NAME}
	aria-label={label}
	class="my-0.5 w-28 shrink-0 rounded-sm border border-accent bg-surface px-2 text-xs outline-none"
	onblur={() => finish(true)}
	onkeydown={(e) => {
		e.stopPropagation();
		if (e.key === 'Enter') finish(true);
		else if (e.key === 'Escape') finish(false);
	}}
/>
