<script lang="ts">
	import { fullscreen } from '$lib/shared/fullscreen.svelte';
	import { getBoard } from '../context';
	import WaystoneBar from './WaystoneBar.svelte';

	// Always mounted: keeps the route's state in step with the page and full screen, and shows the
	// bar over the board while presenting.
	const ctx = getBoard();
	const { waystones } = ctx;

	// Leaving full screen (Escape, the browser's own controls) stops presenting.
	let wasFullscreen = false;
	$effect(() => {
		const active = fullscreen.active;
		if (wasFullscreen && !active && waystones.presenting) waystones.presenting = false;
		wasFullscreen = active;
	});
	// Presenting ends with its route.
	$effect(() => {
		if (waystones.presenting && waystones.route.length === 0) waystones.stopPresenting();
	});
	// Another page, another route.
	$effect(() => {
		void ctx.pages.current;
		waystones.reset();
	});

	function onkeydown(e: KeyboardEvent) {
		// Without full screen (not allowed here), Escape is the way out.
		if (e.key === 'Escape' && waystones.presenting) {
			e.preventDefault();
			waystones.stopPresenting();
		}
	}
</script>

<svelte:window {onkeydown} />

{#if waystones.presenting}
	<WaystoneBar floating />
{/if}
