<script lang="ts">
	import Music from '@lucide/svelte/icons/music';
	import Play from '@lucide/svelte/icons/play';
	import Repeat from '@lucide/svelte/icons/repeat';
	import Video from '@lucide/svelte/icons/video';
	import type { MediaElement } from '$lib/model/types';
	import { getBoard } from '../../context';
	import { embedUrl } from '../../media/parseMediaUrl';
	import { posterSubtitle } from '../../media/poster';
	import { radiusPx } from '../common';
	import type { ElementViewProps } from '../registry';

	let { el, editing }: ElementViewProps<MediaElement> = $props();

	const ctx = getBoard();
	const playing = $derived(ctx.playback.playing.has(el.id));
	const embed = $derived(el.provider === 'youtube' || el.provider === 'vimeo');
	// The player's src is fixed when playback starts: a move or a title edit must not reload it.
	let src = $state<string | null>(null);
	$effect(() => {
		if (!playing) {
			src = null;
			return;
		}
		if (src) return;
		src =
			embed && el.mediaId
				? embedUrl(el.provider as 'youtube' | 'vimeo', el.mediaId, el.start)
				: el.start > 0
					? `${el.url}#t=${el.start}`
					: el.url;
	});

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
	let failed = $state(false);
	$effect(() => {
		if (!playing) failed = false;
	});

	// While interacting, the player takes pointer events; a press anywhere else leaves interaction
	// (playback goes on).
	let box = $state<HTMLDivElement>();
	$effect(() => {
		if (!editing) return;
		const onDown = (e: PointerEvent) => {
			if (e.target instanceof Node && box?.contains(e.target)) return;
			ctx.editing.end();
		};
		document.addEventListener('pointerdown', onDown, true);
		return () => document.removeEventListener('pointerdown', onDown, true);
	});

	const unavailable = $derived(embed && !online);
	const subtitle = $derived(posterSubtitle(el));
	const Icon = $derived(el.provider === 'audio' ? Music : Video);
</script>

<div
	bind:this={box}
	class="absolute inset-0 overflow-hidden text-white select-none"
	class:pointer-events-auto={editing}
	style:border-radius="{radiusPx(el.style)}px"
	style:background={el.style.fill}
	data-media={el.provider}
	data-playing={playing || undefined}
>
	{#if playing && src && embed}
		<iframe
			{src}
			title={el.title}
			class="size-full border-0"
			allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
			referrerpolicy="strict-origin-when-cross-origin"
			sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
			allowfullscreen
		></iframe>
	{:else if playing && src && !failed}
		{#if el.provider === 'audio'}
			<div class="flex size-full flex-col justify-center gap-1 px-3">
				<p class="truncate text-xs font-medium opacity-80">{el.title}</p>
				<audio {src} controls autoplay loop={el.loop} class="w-full" onerror={() => (failed = true)}
				></audio>
			</div>
		{:else}
			<!-- svelte-ignore a11y_media_has_caption -->
			<video
				{src}
				controls
				autoplay
				playsinline
				loop={el.loop}
				class="size-full bg-black object-contain"
				onerror={() => (failed = true)}
			></video>
		{/if}
	{:else}
		<!-- The poster: nothing is requested from the provider until playback starts. -->
		<div class="flex size-full flex-col p-3" class:justify-center={el.provider === 'audio'}>
			<div
				class="flex min-h-0 flex-1 items-center justify-center"
				class:hidden={el.provider === 'audio'}
			>
				<span
					class="flex size-14 items-center justify-center rounded-full bg-white/15"
					class:opacity-40={unavailable || failed}
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
						{failed ? 'Can’t play this file' : unavailable ? 'Offline: can’t play' : subtitle}
					</p>
				</div>
				{#if el.loop}<Repeat class="size-4 shrink-0 opacity-70" aria-label="Loops" />{/if}
			</div>
		</div>
	{/if}
</div>
