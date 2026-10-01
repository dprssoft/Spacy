<script lang="ts">
	import type { StrokeElement } from '$lib/model/types';
	import type { ElementViewProps } from '../registry';
	import { strokeSvgPath } from './strokePath';

	let { el }: ElementViewProps<StrokeElement> = $props();

	// Recomputed only when the points or width change (not on moves).
	const d = $derived(strokeSvgPath(el.points, el.style.strokeWidth));
</script>

<svg width={el.w} height={el.h} class="absolute inset-0 overflow-visible" aria-hidden="true">
	<path {d} fill={el.style.stroke} />
</svg>
