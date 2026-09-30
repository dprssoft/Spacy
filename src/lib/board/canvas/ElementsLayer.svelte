<script lang="ts">
	import { getBoard } from '../context';
	import ElementView from '../elements/ElementView.svelte';
	import { expandRectRatio } from '../engine/geometry';
	import { visibleWorldRect } from '../engine/viewport';

	const { store, viewport, selection } = getBoard();

	// Culling: only elements near the visible area are in the DOM. Recomputed at most once per frame.
	let visible = $state<ReadonlySet<string>>(new Set());
	let frame = 0;

	function recompute() {
		frame = 0;
		const rect = expandRectRatio(visibleWorldRect(viewport.vp, viewport.size), 0.5);
		visible = new Set(store.index.search(rect));
	}

	$effect(() => {
		// Dependencies: viewport and any element change.
		void [viewport.x, viewport.y, viewport.zoom, viewport.size, store.version];
		if (!frame) frame = requestAnimationFrame(recompute);
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
