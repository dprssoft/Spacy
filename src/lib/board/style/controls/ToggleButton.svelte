<script lang="ts">
	import type { Component } from 'svelte';

	let {
		pressed,
		label,
		icon: Icon,
		onchange
	}: {
		pressed: boolean;
		label: string;
		icon: Component<{ class?: string }>;
		onchange: (pressed: boolean) => void;
	} = $props();
</script>

<button
	type="button"
	aria-pressed={pressed}
	aria-label={label}
	title={label}
	onclick={() => onchange(!pressed)}
	class="inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none aria-pressed:bg-accent/15 aria-pressed:text-accent"
>
	<Icon class="size-4" />
</button>
