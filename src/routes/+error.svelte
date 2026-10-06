<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
</script>

<svelte:head><title>{page.status} — Spacy</title></svelte:head>

<main class="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
	<p class="text-5xl font-semibold text-muted">{page.status}</p>
	<h1 class="text-lg font-medium">
		{page.status === 404 ? 'Page not found' : (page.error?.message ?? 'Something went wrong')}
	</h1>
	<a
		href={resolve('/')}
		class="mt-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-contrast hover:opacity-90"
	>
		Back to boards
	</a>
</main>
