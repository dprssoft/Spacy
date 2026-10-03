<script lang="ts">
	import Play from '@lucide/svelte/icons/play';
	import Repeat from '@lucide/svelte/icons/repeat';
	import Music from '@lucide/svelte/icons/music';
	import Video from '@lucide/svelte/icons/video';
	import type { MediaElement } from '$lib/model/types';
	import { getBoard } from '../../context';
	import { posterSubtitle } from '../../media/poster';
	import { radiusPx } from '../common';
	import type { ElementViewProps } from '../registry';
	import MediaPlayer from './MediaPlayer.svelte';

	let { el, editing }: ElementViewProps<MediaElement> = $props();

	const ctx = getBoard();
	const playing = $derived(ctx.playback.playing.has(el.id));
	const embed = $derived(el.provider === 'youtube' || el.provider === 'vimeo');

	let online = $state(typeof navigator === 'undefined' ? true : navigator.onLine);
	$effect(() => {
		const update = () => (online = navigator.onLine);
		window.addEventListener('online', update);
		window.addEventListener('offline', update);
		return () => {
			window.removeEventListener('online', update);
			window.removeEventListener('offline', update);
		};
	});

	// While interacting, the player takes pointer events; a press anywhere else leaves interaction
	// (playback goes on). Presses on the controls bar don't count.
	let box = $state<HTMLDivElement>();
	$effect(() => {
		if (!editing) return;
		const onDown = (e: PointerEvent) => {
			const t = e.target;
			if (t instanceof Node && box?.contains(t)) return;
			if (t instanceof Element && t.closest('[data-testid="media-controls"]')) return;
			ctx.editing.end();
		};
		document.addEventListener('pointerdown', onDown, true);
		return () => document.removeEventListener('pointerdown', onDown, true);
	});

	let fullscreen = $state(false);
	$effect(() => {
		const update = () => (fullscreen = !!box && document.fullscreenElement === box);
		document.addEventListener('fullscreenchange', update);
		return () => document.removeEventListener('fullscreenchange', update);
	});

	const unavailable = $derived(embed && !online);
	const subtitle = $derived(posterSubtitle(el));
	const Icon = $derived(el.provider === 'audio' ? Music : Video);
</script>

<div
	bind:this={box}
	class="absolute inset-0 overflow-hidden text-white select-none"
	class:pointer-events-auto={editing || fullscreen}
	style:border-radius="{radiusPx(el.style)}px"
	style:background={el.style.fill}
	data-media={el.provider}
	data-playing={playing || undefined}
>
	{#if playing && !(embed && !online)}
		<MediaPlayer {el} {fullscreen} />
	{:else}
		<!-- The poster: nothing is requested from the provider until playback starts. -->
		<div class="flex size-full flex-col p-3" class:justify-center={el.provider === 'audio'}>
			<div
				class="flex min-h-0 flex-1 items-center justify-center"
				class:hidden={el.provider === 'audio'}
			>
				<span
					class="flex size-14 items-center justify-center rounded-full bg-white/15"
					class:opacity-40={unavailable}
					aria-hidden="true"
				>
					<Play class="ml-1 size-7 fill-current" />
				</span>
			</div>
			<div class="flex items-center gap-2">
				{#if el.provider === 'audio'}
					<span
						class="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15"
						aria-hidden="true"
					>
						<Play class="ml-0.5 size-5 fill-current" />
					</span>
				{:else}
					<Icon class="size-4 shrink-0 opacity-70" aria-hidden="true" />
				{/if}
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-medium" data-media-title>{el.title}</p>
					<p class="truncate text-xs opacity-70">
						{unavailable ? 'Offline: can’t play' : subtitle}
					</p>
				</div>
				{#if el.loop}<Repeat class="size-4 shrink-0 opacity-70" aria-label="Loops" />{/if}
			</div>
		</div>
	{/if}
</div>
