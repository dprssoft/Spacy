<script lang="ts">
	import type { Element, Marker, Routing } from '$lib/model/types';
	import { markerShape, MARKERS } from '../diagram/markers';
	import type { AppearancePatch } from './applyStyle';
	import Segmented from './controls/Segmented.svelte';
	import { commonValue, MIXED } from './options';

	let { els, apply }: { els: Element[]; apply: (patch: AppearancePatch) => void } = $props();

	const conns = $derived(els.filter((e) => e.type === 'connector'));
	const routing = $derived(commonValue(conns, (e) => (e.type === 'connector' ? e.routing : null)));
	const start = $derived(
		commonValue(conns, (e) => (e.type === 'connector' ? e.markerStart : null))
	);
	const end = $derived(commonValue(conns, (e) => (e.type === 'connector' ? e.markerEnd : null)));
	const labelBg = $derived(
		commonValue(conns, (e) => (e.type === 'connector' ? e.label.background : null))
	);
</script>

{#snippet markerPicker(
	label: string,
	value: Marker | null | typeof MIXED,
	onpick: (m: Marker) => void,
	flip: boolean
)}
	<div role="radiogroup" aria-label={label} class="flex gap-0.5 rounded-lg bg-surface-2 p-0.5">
		{#each MARKERS as m (m.value)}
			{@const shape = markerShape(m.value, 10)}
			<button
				type="button"
				role="radio"
				aria-checked={value === m.value}
				aria-label="{label}: {m.label}"
				title={m.label}
				onclick={() => onpick(m.value)}
				class="inline-flex h-7 w-8 items-center justify-center rounded-md text-muted hover:text-text aria-checked:bg-surface aria-checked:text-text aria-checked:shadow-sm"
			>
				<svg
					viewBox="-16 -8 32 16"
					class="h-4 w-8"
					aria-hidden="true"
					style:transform={flip ? 'scaleX(-1)' : ''}
				>
					<line
						x1="-14"
						y1="0"
						x2={shape ? -2 : 12}
						y2="0"
						stroke="currentColor"
						stroke-width="1.5"
					/>
					{#if shape}
						<path
							d={shape.d}
							transform="translate(12 0)"
							fill={shape.open ? 'none' : shape.filled ? 'currentColor' : 'var(--surface)'}
							stroke="currentColor"
							stroke-width="1.5"
						/>
					{/if}
				</svg>
			</button>
		{/each}
	</div>
{/snippet}

<Segmented
	label="Routing"
	value={routing === null ? MIXED : routing}
	options={[
		{ value: 'straight', label: 'Straight', text: 'Straight' },
		{ value: 'elbow', label: 'Elbow', text: 'Elbow' },
		{ value: 'curve', label: 'Curve', text: 'Curve' }
	]}
	onchange={(v: Routing) => apply({ routing: v })}
/>
<span class="text-xs text-muted">Start</span>
{@render markerPicker('Start marker', start, (m) => apply({ markerStart: m }), true)}
<span class="text-xs text-muted">End</span>
{@render markerPicker('End marker', end, (m) => apply({ markerEnd: m }), false)}
{#if conns.some((c) => c.type === 'connector' && c.waypoints.length > 0)}
	<button
		type="button"
		class="text-xs text-accent hover:underline"
		title="Reset route to auto-layout"
		onclick={() => apply({ waypoints: [] })}>Reset route</button
	>
{/if}
<label class="flex items-center justify-between gap-6 self-stretch text-xs text-muted">
	Label background
	<input
		type="checkbox"
		class="size-4 accent-[var(--accent)]"
		checked={labelBg === true}
		onchange={(e) => apply({ labelBackground: e.currentTarget.checked })}
	/>
</label>
