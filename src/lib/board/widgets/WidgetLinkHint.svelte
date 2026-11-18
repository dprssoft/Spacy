<script lang="ts">
	import type { Point, Rect } from '$lib/model/types';
	import { getBoard } from '../context';
	import { worldToScreen } from '../engine/viewport';
	import { linkedCard } from './kinds';

	// While a widget that reads a doc card (a progress widget's checklist) is selected, a dashed
	// line shows which card it is.
	const { selection, store, viewport } = getBoard();

	const center = (r: Rect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

	/** Where the line from `r`'s center towards `to` leaves `r`. */
	function edge(r: Rect, to: Point): Point {
		const c = center(r);
		const dx = to.x - c.x;
		const dy = to.y - c.y;
		const t = Math.min(
			dx === 0 ? Infinity : r.w / 2 / Math.abs(dx),
			dy === 0 ? Infinity : r.h / 2 / Math.abs(dy)
		);
		return t >= 1 ? c : { x: c.x + dx * t, y: c.y + dy * t };
	}

	const line = $derived.by(() => {
		void store.version;
		if (selection.transforming || selection.editingId) return null;
		const id = selection.single;
		const el = id ? store.get(id) : undefined;
		if (el?.type !== 'widget') return null;
		const cardId = linkedCard(el);
		const card = cardId ? store.get(cardId) : undefined;
		if (!card) return null;
		const a = worldToScreen(viewport.vp, edge(el, center(card)));
		const b = worldToScreen(viewport.vp, edge(card, center(el)));
		return { a, b };
	});
</script>

{#if line}
	<svg class="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden="true">
		<line
			x1={line.a.x}
			y1={line.a.y}
			x2={line.b.x}
			y2={line.b.y}
			stroke="var(--selection)"
			stroke-width="1.5"
			stroke-dasharray="5 4"
			data-testid="widget-link-hint"
		/>
		<circle cx={line.b.x} cy={line.b.y} r="3" fill="var(--selection)" />
	</svg>
{/if}
