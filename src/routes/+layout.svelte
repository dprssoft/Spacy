<script lang="ts">
	import '../app.css';
	import { Tooltip } from 'bits-ui';
	import { Toaster } from 'svelte-sonner';
	import favicon from '$lib/assets/favicon.svg';
	import { theme } from '$lib/shared/theme.svelte';

	let { children } = $props();

	$effect(() => theme.init());
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<Tooltip.Provider delayDuration={400}>
	{@render children()}
</Tooltip.Provider>

<Toaster richColors closeButton position="bottom-center" theme={theme.resolved} />
