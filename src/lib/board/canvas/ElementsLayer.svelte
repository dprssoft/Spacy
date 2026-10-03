<script lang="ts">
	import type { Rect } from '$lib/model/types';
	import { timed } from '$lib/dev/testHooks';
	import { getBoard } from '../context';
	import ElementView from '../elements/ElementView.svelte';
	import { expandRectRatio } from '../engine/geometry';
	import { visibleWorldRect } from '../engine/viewport';
	import { measureBoardOpen } from '../openTiming';

	const { store, viewport, selection } = getBoard();

	// Culling: only elements near the visible area are in the DOM. Recomputed at most once per frame.
	let visible = $state<ReadonlySet<string>>(new Set());
	let frame = 0;

	let measured = false;
	// What the last search covered: while the view stays inside it (same zoom, same content) the
	// visible set can't have changed, so panning doesn't re-diff the mounted elements.
	let covered: { rect: Rect; zoom: number; version: number } | null = null;

	const contains = (outer: Rect, inner: Rect) =>
		inner.x >= outer.x &&
		inner.y >= outer.y &&
		inner.x + inner.w <= outer.x + outer.w &&
		inner.y + inner.h <= outer.y + outer.h;

	function recompute() {
		frame = 0;
		const view = visibleWorldRect(viewport.vp, viewport.size);
		if (
			covered &&
			covered.zoom === viewport.zoom &&
			covered.version === store.version &&
			contains(covered.rect, view)
		)
			return;
		const rect = expandRectRatio(view, 0.5);
		covered = { rect, zoom: viewport.zoom, version: store.version };
		const ids = store.index.search(rect);
		// Same ids as before (e.g. everything is visible): keep the set, skip the re-render.
		if (ids.length !== visible.size || ids.some((id) => !visible.has(id))) visible = new Set(ids);
		if (!measured && viewport.size.w > 0) {
			measured = true;
			// After the frame that paints the first visible elements.
			requestAnimationFrame(() => requestAnimationFrame(measureBoardOpen));
		}
	}

	$effect(() => {
		// Dependencies: viewport and any element change.
		void [viewport.x, viewport.y, viewport.zoom, viewport.size, store.version];
		if (!frame) frame = requestAnimationFrame(() => timed('layer.cull', recompute));
	});
	$effect(() => () => cancelAnimationFrame(frame));

	// Selected and edited elements stay mounted even when scrolled out of view.
	const show = (id: string) => visible.has(id) || selection.has(id) || selection.editingId === id;
	const frames = $derived(store.frameOrder.filter(show));
	const others = $derived(store.order.filter(show));
</script>

{#each frames as id (id)}
	<ElementView {id} />
{/each}
{#each others as id (id)}
	<ElementView {id} />
{/each}
