<script lang="ts">
	import ThemeToggle from '$lib/shared/ui/ThemeToggle.svelte';
</script>

<svelte:head><title>SMTHNG</title></svelte:head>

<header class="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
	<h1 class="text-xl font-semibold">SMTHNG</h1>
	<ThemeToggle />
</header>
<main class="p-6">
	<p class="text-muted">Your boards</p>
</main>
