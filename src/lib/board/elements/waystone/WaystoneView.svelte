<script lang="ts">
	import type { WaystoneElement } from '$lib/model/types';
	import { getBoard } from '../../context';
	import { OVERLAY_LABELS_BELOW } from '../../waystones/labels';
	import { PIN_H, PIN_HEAD, PIN_PATH, PIN_W } from '../../waystones/pin';
	import type { ElementViewProps } from '../registry';

	let { el }: ElementViewProps<WaystoneElement> = $props();

	const ctx = getBoard();
	const number = $derived(ctx.waystones.route.findIndex((w) => w.id === el.id) + 1);
	const labelled = $derived(ctx.viewport.zoom >= OVERLAY_LABELS_BELOW);
</script>

<svg
	class="absolute inset-0 overflow-visible"
	width={PIN_W}
	height={PIN_H}
	viewBox="0 0 {PIN_W} {PIN_H}"
	aria-hidden="true"
>
	<path d={PIN_PATH} fill={el.style.fill} />
	{#if labelled && number > 0}
		<text
			x={PIN_HEAD.x}
			y={PIN_HEAD.y + 4.5}
			text-anchor="middle"
			font-size="13"
			font-weight="700"
			fill={el.style.font.color}>{number}</text
		>
	{/if}
</svg>
{#if labelled && el.name}
	<span
		class="absolute top-1.5 left-[38px] max-w-60 truncate rounded bg-surface/85 px-1.5 text-[13px] leading-5 font-semibold whitespace-nowrap text-text"
		data-waystone-name>{el.name}</span
	>
{/if}
