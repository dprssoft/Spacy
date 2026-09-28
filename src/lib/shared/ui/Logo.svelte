<script lang="ts">
	let { class: className = '' }: { class?: string } = $props();
</script>

<svg viewBox="0 0 32 32" class={className} aria-hidden="true">
	<rect width="32" height="32" rx="8" fill="var(--accent)" />
	<path
		d="M16 7 25 16 16 25 7 16Z"
		fill="none"
		stroke="var(--accent-contrast)"
		stroke-width="2.5"
	/>
	<circle cx="16" cy="16" r="2.5" fill="var(--accent-contrast)" />
</svg>
