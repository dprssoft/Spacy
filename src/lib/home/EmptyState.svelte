<script lang="ts">
	import type { Component, Snippet } from 'svelte';

	let {
		icon: Icon,
		title,
		text,
		action
	}: {
		icon: Component<{ class?: string }>;
		title: string;
		text: string;
		action?: Snippet;
	} = $props();
</script>

<div class="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
	<div class="mb-2 flex size-14 items-center justify-center rounded-2xl bg-surface-2 text-muted">
		<Icon class="size-7" />
	</div>
	<h3 class="text-base font-medium">{title}</h3>
	<p class="max-w-sm text-sm text-muted">{text}</p>
	{#if action}<div class="mt-3">{@render action()}</div>{/if}
</div>
