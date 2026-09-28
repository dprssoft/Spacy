<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
</script>

<svelte:head><title>Board — SMTHNG</title></svelte:head>

<main class="p-6">
	<p class="mb-4">Board <span class="font-mono">{page.params.id}</span></p>
	<a href={resolve('/')} class="text-accent underline-offset-2 hover:underline">Back to boards</a>
</main>
