<script lang="ts">
	import { getBoard } from '../context';
	import { worldToScreen } from '../engine/viewport';
	import { OVERLAY_LABELS_BELOW } from './labels';
	import { anchorOf } from './route';

	// Zoomed out, pins get tiny: their number and name stay readable here, at a constant size.
	// Clicking one flies there.
	const ctx = getBoard();
	const { viewport, waystones } = ctx;

	const labels = $derived.by(() => {
		if (viewport.zoom >= OVERLAY_LABELS_BELOW) return [];
		const { w, h } = viewport.size;
		return waystones.route.flatMap((wy, i) => {
			const p = worldToScreen(viewport.vp, anchorOf(wy));
			if (p.x < -200 || p.y < -40 || p.x > w + 40 || p.y > h + 60) return [];
			return [{ id: wy.id, i, name: wy.name, color: wy.style.fill, x: p.x, y: p.y }];
		});
	});
</script>

{#each labels as l (l.id)}
	<button
		type="button"
		class="pointer-events-auto absolute flex -translate-x-3 -translate-y-full items-center gap-1 rounded-full py-0.5 pr-2 pl-0.5 text-xs font-semibold text-text shadow hover:brightness-110"
		style:left="{l.x}px"
		style:top="{l.y}px"
		style:background="color-mix(in srgb, var(--surface) 90%, transparent)"
		data-interactive
		data-waystone-label={l.id}
		aria-label="Go to waystone {l.i + 1}: {l.name}"
		onclick={() => waystones.go(l.i)}
	>
		<span
			class="flex size-5 items-center justify-center rounded-full text-[11px] text-white"
			style:background={l.color}>{l.i + 1}</span
		><span class="max-w-40 truncate">{l.name}</span>
	</button>
{/each}
