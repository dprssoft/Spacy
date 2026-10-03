<script lang="ts">
	import type { MediaElement } from '$lib/model/types';
	import { getBoard } from '../../context';
	import { togglePlay } from '../../media/commands';
	import type { MediaController } from '../../media/controller';
	import MediaControls from '../../media/MediaControls.svelte';
	import { NativeController } from '../../media/native';
	import { embedUrl } from '../../media/parseMediaUrl';
	import { runSession } from '../../media/session';
	import { VimeoController } from '../../media/vimeo';
	import { YouTubeController } from '../../media/youtube';

	// The live player of a playing media element, driven through a controller so the board's
	// own controls work the same for embeds and files.
	let { el, fullscreen }: { el: MediaElement; fullscreen: boolean } = $props();

	const ctx = getBoard();
	// svelte-ignore state_referenced_locally
	const startAt = el.start; // fixed for this playback: edits must not reload the player
	const embed = $derived(el.provider === 'youtube' || el.provider === 'vimeo');
	const fallback = $derived(ctx.playback.fallback.has(el.id));
	const src = $derived(
		embed && el.mediaId
			? embedUrl(el.provider as 'youtube' | 'vimeo', el.mediaId, startAt, {
					controls: fallback,
					origin: location.origin
				})
			: startAt > 0
				? `${el.url}#t=${startAt}`
				: el.url
	);

	let node = $state<HTMLIFrameElement | HTMLMediaElement>();
	let controller = $state<MediaController | null>(null);
	let failed = $state(false);

	$effect(() => {
		const n = node;
		if (!n || (embed && fallback)) return;
		const c: MediaController =
			n instanceof HTMLIFrameElement
				? el.provider === 'youtube'
					? new YouTubeController(n)
					: new VimeoController(n)
				: new NativeController(n);
		const id = el.id;
		const unregister = ctx.playback.register(id, c);
		const endSession = runSession(c, () => ({ start: el.start, end: el.end, loop: el.loop }));
		const unwatch = c.subscribe(() => {
			if (c.state.fallback) ctx.playback.fallback.add(id);
			failed = c.state.error !== null && !embed;
		});
		controller = c;
		return () => {
			unwatch();
			endSession();
			unregister();
			c.destroy();
			if (controller === c) controller = null;
		};
	});
</script>

{#if embed}
	{#key src}
		<iframe
			bind:this={node}
			{src}
			title={el.title}
			class="size-full border-0"
			allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
			referrerpolicy="strict-origin-when-cross-origin"
			sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
			allowfullscreen
		></iframe>
	{/key}
{:else if failed}
	<div class="flex size-full items-center justify-center p-3 text-sm opacity-80">
		Can’t play this file
	</div>
{:else if el.provider === 'audio'}
	<div class="flex size-full flex-col justify-center gap-1 px-3">
		<p class="truncate text-sm font-medium">{el.title}</p>
		<p class="text-xs opacity-70">Playing</p>
		<audio bind:this={node} {src} autoplay class="hidden"></audio>
	</div>
{:else}
	<!-- svelte-ignore a11y_media_has_caption -->
	<video
		bind:this={node}
		{src}
		autoplay
		playsinline
		class="size-full bg-black object-contain"
		onclick={() => controller && togglePlay(controller, el)}
	></video>
{/if}
{#if fullscreen && controller}
	<div class="absolute inset-x-3 bottom-3">
		<MediaControls {el} {controller} fullscreen />
	</div>
{/if}
