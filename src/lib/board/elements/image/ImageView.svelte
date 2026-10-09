<script lang="ts">
	import ImageOff from '@lucide/svelte/icons/image-off';
	import type { ImageElement } from '$lib/model/types';
	import { getBoard } from '../../context';
	import { dashArray, radiusPx } from '../common';
	import type { ElementViewProps } from '../registry';

	let { el }: ElementViewProps<ImageElement> = $props();

	const { assets } = getBoard();
	let status = $state<'loading' | 'downloading' | 'ready' | 'missing'>('loading');
	let url = $state<string | null>(null);

	$effect(() => {
		let alive = true;
		status = 'loading';
		const downloading = () => {
			if (alive) status = 'downloading';
		};
		void assets.get(el.assetId, downloading).then((u) => {
			if (!alive) return;
			url = u;
			status = u ? 'ready' : 'missing';
		});
		return () => {
			alive = false;
		};
	});

	const radius = $derived(radiusPx(el.style));
	const bordered = $derived(el.style.stroke !== 'transparent');
</script>

<div class="absolute inset-0 overflow-hidden" style:border-radius="{radius}px">
	{#if status === 'ready' && url}
		<img
			src={url}
			alt=""
			draggable="false"
			class="block size-full select-none"
			style:object-fit="fill"
		/>
	{:else if status === 'downloading'}
		<div
			class="flex size-full animate-pulse items-center justify-center bg-surface-2 text-sm text-muted"
		>
			Downloading…
		</div>
	{:else if status === 'missing'}
		<div class="flex size-full items-center justify-center bg-surface-2 text-muted">
			<ImageOff class="size-6" aria-hidden="true" />
		</div>
	{:else}
		<div class="size-full animate-pulse bg-surface-2"></div>
	{/if}
</div>
{#if bordered}
	<svg width={el.w} height={el.h} class="absolute inset-0 overflow-visible" aria-hidden="true">
		<rect
			x={el.style.strokeWidth / 2}
			y={el.style.strokeWidth / 2}
			width={Math.max(0, el.w - el.style.strokeWidth)}
			height={Math.max(0, el.h - el.style.strokeWidth)}
			rx={radius}
			fill="none"
			stroke={el.style.stroke}
			stroke-width={el.style.strokeWidth}
			stroke-dasharray={dashArray(el.style.dash, el.style.strokeWidth)}
		/>
	</svg>
{/if}
