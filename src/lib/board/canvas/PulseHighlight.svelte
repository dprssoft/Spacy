<script lang="ts">
	import { getBoard } from '../context';
	import { definitionOf } from '../elements';
	import { worldToScreen } from '../engine/viewport';

	const { preview, store, viewport } = getBoard();
	const PULSE_MS = 1000;

	const rect = $derived.by(() => {
		const p = preview.pulse;
		const el = p ? store.get(p.id) : undefined;
		if (!el) return null;
		const r = definitionOf(el).aabb(el, store.world);
		const a = worldToScreen(viewport.vp, { x: r.x, y: r.y });
		const b = worldToScreen(viewport.vp, { x: r.x + r.w, y: r.y + r.h });
		return { x: a.x - 6, y: a.y - 6, w: b.x - a.x + 12, h: b.y - a.y + 12 };
	});

	$effect(() => {
		const p = preview.pulse;
		if (!p) return;
		const t = setTimeout(() => {
			if (preview.pulse === p) preview.pulse = null;
		}, PULSE_MS);
		return () => clearTimeout(t);
	});
</script>

{#if rect && preview.pulse}
	{#key preview.pulse.n}
		<div
			class="pulse pointer-events-none absolute rounded-lg border-2 border-accent"
			style:left="{rect.x}px"
			style:top="{rect.y}px"
			style:width="{rect.w}px"
			style:height="{rect.h}px"
			data-pulse={preview.pulse.id}
			aria-hidden="true"
		></div>
	{/key}
{/if}

<style>
	.pulse {
		animation: pulse 1s ease-out forwards;
	}
	@keyframes pulse {
		0% {
			opacity: 0;
			box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 45%, transparent);
		}
		20% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			box-shadow: 0 0 0 16px transparent;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.pulse {
			animation: none;
		}
	}
</style>
