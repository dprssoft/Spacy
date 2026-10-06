<script lang="ts">
	import HomePage from '$lib/home/HomePage.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Spacy</title></svelte:head>

<HomePage templatePreviews={data.templatePreviews} />
