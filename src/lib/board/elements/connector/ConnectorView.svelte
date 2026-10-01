<script lang="ts">
	import type { ConnectorElement } from '$lib/model/types';
	import { getBoard } from '../../context';
	import { connectorGeometry } from '../../diagram/geometry';
	import { dashArray } from '../common';
	import type { ElementViewProps } from '../registry';

	let { el }: ElementViewProps<ConnectorElement> = $props();

	const { store } = getBoard();
	// Reading the attached elements through the store makes this re-render when they move.
	const geo = $derived.by(() => {
		if (el.from.kind !== 'free') void store.get(el.from.elementId);
		if (el.to.kind !== 'free') void store.get(el.to.elementId);
		return connectorGeometry(el, store.world);
	});

	/** A simple arrowhead at the end (marker styles arrive in step 21). */
	const arrow = $derived.by(() => {
		if (el.markerEnd === 'none') return '';
		const pts = geo.points;
		const tip = pts[pts.length - 1]!;
		const prev = pts[pts.length - 2] ?? tip;
		const a = Math.atan2(tip.y - prev.y, tip.x - prev.x);
		const len = 8 + el.style.strokeWidth * 2;
		const spread = 0.45;
		const p1 = { x: tip.x - Math.cos(a - spread) * len, y: tip.y - Math.sin(a - spread) * len };
		const p2 = { x: tip.x - Math.cos(a + spread) * len, y: tip.y - Math.sin(a + spread) * len };
		return `M${p1.x},${p1.y} L${tip.x},${tip.y} L${p2.x},${p2.y} Z`;
	});
</script>

<svg class="absolute top-0 left-0 overflow-visible" width="1" height="1" aria-hidden="true">
	<path
		d={geo.d}
		fill="none"
		stroke={el.style.stroke}
		stroke-width={el.style.strokeWidth}
		stroke-dasharray={dashArray(el.style.dash, el.style.strokeWidth)}
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
	{#if arrow}
		<path d={arrow} fill={el.style.stroke} stroke={el.style.stroke} stroke-linejoin="round" />
	{/if}
</svg>
