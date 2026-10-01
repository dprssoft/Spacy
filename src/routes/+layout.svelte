<script lang="ts">
	import '../app.css';
	import { Tooltip } from 'bits-ui';
	import { Toaster } from 'svelte-sonner';
	import { pwa } from '$lib/shared/pwa.svelte';
	import { theme } from '$lib/shared/theme.svelte';

	let { children } = $props();

	$effect(() => theme.init());
	$effect(() => pwa.init());
</script>

<Tooltip.Provider delayDuration={400}>
	{@render children()}
</Tooltip.Provider>

<Toaster richColors closeButton position="bottom-center" theme={theme.resolved} />
