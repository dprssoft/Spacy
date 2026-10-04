<script lang="ts">
	import { untrack } from 'svelte';
	import { getSketchesMap } from '$lib/model/doc';
	import type { Element } from '$lib/model/types';
	import { theme } from '$lib/shared/theme.svelte';
	import { getBoard } from '../context';
	import { visibleWorldRect } from '../engine/viewport';
	import { SceneRenderer, type SceneTheme } from '../render/canvasScene';
	import { readStrokes } from '../sketch/data';
	import { paintGrid } from './grid';

	const ctx = getBoard();
	const { store, viewport, selection, preview, assets } = ctx;

	let canvas = $state<HTMLCanvasElement>();
	const renderer = new SceneRenderer();
	// The canvas covers exactly the view; it lives in world space, so the world transform maps
	// it 1:1 onto the screen.
	const view = $derived(visibleWorldRect(viewport.vp, viewport.size));

	// Decoded images by asset id (null: loading or missing). A load triggers a redraw.
	// Not reactive state: `imagesLoaded` is the signal.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const images = new Map<string, HTMLImageElement | null>();
	let imagesLoaded = $state(0);
	function image(assetId: string): HTMLImageElement | null {
		if (images.has(assetId)) return images.get(assetId) ?? null;
		images.set(assetId, null);
		void assets.get(assetId).then((url) => {
			if (!url) return;
			const img = new Image();
			img.onload = () => {
				images.set(assetId, img);
				imagesLoaded++;
			};
			img.src = url;
		});
		return null;
	}

	let colors: { mode: string; theme: SceneTheme & { dot: string } } | null = null;
	function sceneTheme(node: HTMLElement) {
		if (colors?.mode !== theme.key) {
			const css = getComputedStyle(node);
			const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
			colors = {
				mode: theme.key,
				theme: {
					ink: v('--ink', '#1e1e1e'),
					canvasBg: v('--canvas-bg', '#ffffff'),
					placeholder: v('--surface-2', '#e4e4e7'),
					dot: v('--canvas-dot', '#d4d4d8')
				}
			};
		}
		return colors.theme;
	}

	function draw(node: HTMLCanvasElement) {
		const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
		const w = Math.max(1, Math.round(viewport.size.w * dpr));
		const h = Math.max(1, Math.round(viewport.size.h * dpr));
		if (node.width !== w) node.width = w;
		if (node.height !== h) node.height = h;
		const c = node.getContext('2d');
		if (!c) return;
		// Edited and playing elements are live DOM views above the canvas.
		// A throwaway lookup per draw.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const near = new Set(store.index.search(view));
		near.delete(selection.editingId ?? '');
		for (const id of ctx.playback.playing) near.delete(id);
		const els: Element[] = [];
		for (const order of [store.frameOrder, store.order])
			for (const id of order) {
				const el = near.has(id) ? store.get(id) : undefined;
				if (el) els.push(el);
			}
		c.setTransform(1, 0, 0, 1, 0, 0);
		c.clearRect(0, 0, w, h);
		const t = sceneTheme(node);
		// The background grid is off while this canvas is shown: one layer composites faster.
		if (ctx.prefs.grid) paintGrid(c, viewport.vp, dpr, t.dot);
		renderer.draw(
			c,
			els,
			viewport.vp,
			dpr,
			{ world: store.world, strokes: (id) => readStrokes(ctx.doc, id), image },
			t,
			(id) => preview.erasing.has(id)
		);
	}

	// Sketch strokes live outside the elements map, so the store doesn't see them change.
	let strokesVersion = $state(0);
	$effect(() => {
		const sketches = getSketchesMap(ctx.doc);
		const bump = () => strokesVersion++;
		sketches.observeDeep(bump);
		return () => sketches.unobserveDeep(bump);
	});

	// Redrawn synchronously with the DOM update, so the canvas never lags the world transform.
	$effect(() => {
		void [
			view,
			store.version,
			strokesVersion,
			theme.key,
			ctx.prefs.grid,
			imagesLoaded,
			preview.erasing.size
		];
		void selection.editingId;
		void ctx.playback.playing.size;
		const node = canvas;
		if (node) untrack(() => draw(node));
	});
</script>

<canvas
	bind:this={canvas}
	class="pointer-events-none absolute top-0 left-0"
	style:transform="translate({view.x}px, {view.y}px)"
	style:width="{view.w}px"
	style:height="{view.h}px"
	aria-hidden="true"
	data-testid="scene-canvas"
></canvas>
