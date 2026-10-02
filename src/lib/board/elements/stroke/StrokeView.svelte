<script lang="ts">
	import type { StrokeElement } from '$lib/model/types';
	import { ink } from '../common';
	import type { ElementViewProps } from '../registry';
	import { strokePathMemo } from './strokePath';

	let { el }: ElementViewProps<StrokeElement> = $props();

	// Recomputed only when the points or width actually change (not on moves, which give the
	// element a new snapshot with equal points).
	const pathFor = strokePathMemo();
	const d = $derived(pathFor(el.points, el.style.strokeWidth));
</script>

<svg width={el.w} height={el.h} class="absolute inset-0 overflow-visible" aria-hidden="true">
	<path {d} fill={ink(el.style.stroke)} />
</svg>
