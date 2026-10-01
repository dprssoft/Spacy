<script lang="ts">
	import { FONT_SIZE_PX, LINE_HEIGHT, FONT_FAMILY } from '$lib/model/defaults';
	import { updateElement } from '$lib/model/ops';
	import type { ConnectorElement } from '$lib/model/types';
	import { getBoard } from '../../context';
	import { connectorGeometry } from '../../diagram/geometry';
	import { markerShape, markerSize, markerTransform } from '../../diagram/markers';
	import { pointAt } from '../../diagram/routing';
	import { dashArray } from '../common';
	import type { ElementViewProps } from '../registry';

	let { el, editing }: ElementViewProps<ConnectorElement> = $props();

	const ctx = getBoard();
	const { store } = ctx;
	// Reading the attached elements through the store makes this re-render when they move.
	const geo = $derived.by(() => {
		if (el.from.kind !== 'free') void store.get(el.from.elementId);
		if (el.to.kind !== 'free') void store.get(el.to.elementId);
		return connectorGeometry(el, store.world);
	});

	const size = $derived(markerSize(el.style.strokeWidth));
	const start = $derived(markerShape(el.markerStart, size));
	const end = $derived(markerShape(el.markerEnd, size));
	const labelAt = $derived(pointAt(geo.route, el.label.t).p);
	const fontPx = $derived(FONT_SIZE_PX[el.style.font.size === 'm' ? 's' : el.style.font.size]);

	let draft = $state('');
	function focusLabel(node: HTMLTextAreaElement) {
		draft = el.label.text;
		node.value = el.label.text;
		node.focus();
		node.select();
	}
	function commit() {
		if (draft !== el.label.text)
			updateElement(ctx.doc, el.id, { label: { ...el.label, text: draft.trim() } });
		ctx.editing.end();
	}
</script>

{#snippet marker(shape: ReturnType<typeof markerShape>, transform: string)}
	{#if shape}
		<path
			d={shape.d}
			{transform}
			fill={shape.open ? 'none' : shape.filled ? el.style.stroke : 'var(--canvas-bg)'}
			stroke={el.style.stroke}
			stroke-width={el.style.strokeWidth}
			stroke-linejoin="round"
			stroke-linecap="round"
		/>
	{/if}
{/snippet}

<svg class="absolute top-0 left-0 overflow-visible" width="1" height="1" aria-hidden="true">
	<path
		d={geo.d}
		fill="none"
		stroke={el.style.stroke}
		stroke-width={el.style.strokeWidth}
		stroke-dasharray={dashArray(el.style.dash, el.style.strokeWidth)}
		stroke-linecap="round"
		stroke-linejoin="round"
		data-route={el.routing}
	/>
	{@render marker(start, markerTransform(geo.start, geo.startAngle))}
	{@render marker(end, markerTransform(geo.end, geo.endAngle))}
</svg>

{#if editing || el.label.text}
	<div
		class="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
		style:left="{labelAt.x}px"
		style:top="{labelAt.y}px"
		style:font-family={FONT_FAMILY}
		style:font-size="{fontPx}px"
		style:line-height={LINE_HEIGHT}
		style:color={el.style.stroke === 'transparent' ? 'var(--text)' : el.style.font.color}
		data-connector-label
	>
		{#if editing}
			<textarea
				{@attach focusLabel}
				bind:value={draft}
				aria-label="Connector label"
				data-interactive
				rows="1"
				class="pointer-events-auto min-w-24 resize-none rounded border border-accent bg-surface px-1.5 text-center outline-none"
				onblur={commit}
				onkeydown={(e) => {
					e.stopPropagation();
					if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) {
						e.preventDefault();
						commit();
					}
				}}></textarea>
		{:else}
			<span
				class="rounded px-1.5 py-0.5 whitespace-pre"
				style:background={el.label.background ? 'var(--canvas-bg)' : 'transparent'}
				>{el.label.text}</span
			>
		{/if}
	</div>
{/if}
