<script lang="ts">
	import Play from '@lucide/svelte/icons/play';
	import Square from '@lucide/svelte/icons/square';
	import { getBoard } from '../context';

	let { id }: { id: string } = $props();

	const ctx = getBoard();
	const playing = $derived(ctx.playback.playing.has(id));
</script>

<button
	type="button"
	aria-label={playing ? 'Stop' : 'Play'}
	title={playing ? 'Stop' : 'Play'}
	data-testid="media-play"
	onclick={() => ctx.playback.toggle(id)}
	class="inline-flex h-8 min-w-8 items-center justify-center rounded-md px-1 text-muted hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
>
	{#if playing}
		<Square class="size-4 fill-current" aria-hidden="true" />
	{:else}
		<Play class="size-4 fill-current" aria-hidden="true" />
	{/if}
</button>
