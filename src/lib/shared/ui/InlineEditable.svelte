<script lang="ts">
	let {
		value,
		onCommit,
		editing = $bindable(false),
		class: className = '',
		inputClass = '',
		ariaLabel
	}: {
		value: string;
		onCommit: (next: string) => void;
		editing?: boolean;
		class?: string;
		inputClass?: string;
		ariaLabel: string;
	} = $props();

	let draft = $state('');
	let cancelled = false;

	function focusAndSelect(node: HTMLInputElement) {
		node.focus();
		node.select();
	}

	$effect(() => {
		if (editing) {
			draft = value;
			cancelled = false;
		}
	});

	function commit() {
		if (!editing) return;
		editing = false;
		const next = draft.trim();
		if (!cancelled && next && next !== value) onCommit(next);
	}

	function onkeydown(e: KeyboardEvent) {
		e.stopPropagation();
		if (e.key === 'Enter') {
			e.preventDefault();
			commit();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			cancelled = true;
			editing = false;
		}
	}
</script>

{#if editing}
	<input
		{@attach focusAndSelect}
		bind:value={draft}
		aria-label={ariaLabel}
		class="w-full min-w-0 rounded-md border border-accent bg-surface px-1.5 py-0.5 outline-none {inputClass}"
		onblur={commit}
		{onkeydown}
		onclick={(e) => e.stopPropagation()}
	/>
{:else}
	<span class={className} title={value}>{value}</span>
{/if}
