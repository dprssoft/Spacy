<script lang="ts">
	import GlassBackdrop from '$lib/shared/ui/GlassBackdrop.svelte';
	import '../app.css';
	import { Tooltip } from 'bits-ui';
	import { Toaster } from 'svelte-sonner';
	import { pwa } from '$lib/shared/pwa.svelte';
	import { theme } from '$lib/shared/theme.svelte';
	import { driveSync } from '$lib/sync/driveSync.svelte';

	let { children } = $props();

	// The start page is prerendered: until the app has hydrated it, its controls don't work yet, so
	// they're inert (no focus, clicks or accessibility tree). `html[data-hydrated]` marks the moment.
	let hydrated = $state(false);
	$effect(() => {
		hydrated = true;
		document.documentElement.dataset.hydrated = '';
	});
	$effect(() => theme.init());
	$effect(() => pwa.init());
	$effect(() => driveSync.init());
</script>

<div class="contents" inert={!hydrated}>
	<Tooltip.Provider delayDuration={400}>
		{@render children()}
	</Tooltip.Provider>
</div>

{#if theme.glass}
	<GlassBackdrop />
{/if}

<Toaster richColors closeButton position="bottom-center" theme={theme.resolved} />
