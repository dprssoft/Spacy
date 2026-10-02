<script lang="ts">
	import { untrack } from 'svelte';
	import { getSketchesMap } from '$lib/model/doc';
	import type { SketchElement } from '$lib/model/types';
	import { theme } from '$lib/shared/theme.svelte';
	import { getBoard } from '../../context';
	import { strokePaint, type SketchStroke, type StrokePaint } from '../../sketch/brushes';
	import { readStrokes } from '../../sketch/data';
	import { DEFAULT_INK } from '../common';
	import type { ElementViewProps } from '../registry';

	let { el }: ElementViewProps<SketchElement> = $props();

	const ctx = getBoard();
	// svelte-ignore state_referenced_locally
	const id = el.id;
	let canvas = $state<HTMLCanvasElement>();
	// Bumped when strokes are added or removed (they live outside the element).
	let version = $state(0);

	$effect(() => {
		const strokes = getSketchesMap(ctx.doc).get(id);
		if (!strokes) return;
		const bump = () => version++;
		strokes.observe(bump);
		return () => strokes.unobserve(bump);
	});

	// One Path2D per stroke, kept for as long as the stroke exists.
	const paths = new WeakMap<SketchStroke, { paint: StrokePaint; path: Path2D }>();
	function painted(s: SketchStroke) {
		let p = paths.get(s);
		if (!p) {
			const paint = strokePaint(s);
			paths.set(s, (p = { paint, path: new Path2D(paint.d) }));
		}
		return p;
	}

	const MAX_SIDE = 4096;
	const MAX_AREA = 12_000_000;
	/** Canvas pixels per board unit: sharp at the current zoom, in steps so zooming redraws rarely. */
	const resolution = $derived.by(() => {
		const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
		const wanted = 2 ** Math.ceil(Math.log2(Math.max(0.25, ctx.viewport.zoom * dpr)));
		const side = MAX_SIDE / Math.max(1, el.w, el.h);
		const area = Math.sqrt(MAX_AREA / Math.max(1, el.w * el.h));
		return Math.min(wanted, side, area);
	});

	// What the drawing depends on. Moving the sketch gives it a new snapshot but the same frame:
	// comparing these values (not the element object) keeps a drag from redrawing every frame.
	const frame = $derived(`${el.w}|${el.h}|${el.bx}|${el.by}|${el.nw}|${el.nh}`);

	function draw() {
		const node = canvas;
		if (!node || el.nw <= 0 || el.nh <= 0) return;
		const k = resolution;
		node.width = Math.max(1, Math.ceil(el.w * k));
		node.height = Math.max(1, Math.ceil(el.h * k));
		const c = node.getContext('2d');
		if (!c) return;
		const sx = (el.w / el.nw) * k;
		const sy = (el.h / el.nh) * k;
		c.setTransform(sx, 0, 0, sy, -el.bx * sx, -el.by * sy);
		// The default dark ink follows the theme, like other strokes on the canvas.
		const ink = theme.resolved === 'dark' ? '#e9e9ee' : DEFAULT_INK;
		for (const stroke of readStrokes(ctx.doc, id)) {
			const { paint, path } = painted(stroke);
			c.globalCompositeOperation = paint.erase ? 'destination-out' : 'source-over';
			c.globalAlpha = paint.erase ? 1 : paint.opacity;
			const color = paint.color.toLowerCase() === DEFAULT_INK ? ink : paint.color;
			if (paint.mode === 'fill') {
				c.fillStyle = color;
				c.fill(path);
			} else {
				c.strokeStyle = color;
				c.lineWidth = paint.width;
				c.lineCap = paint.cap;
				c.lineJoin = 'round';
				c.stroke(path);
			}
		}
	}

	// New strokes, a theme change and a new frame from drawing redraw at once. A frame that changes
	// without new strokes is a resize: the canvas is stretched by CSS meanwhile, and redrawn sharp
	// once the size settles.
	let drawnVersion = -1;
	let pending: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		void [frame, resolution, theme.resolved, canvas];
		const v = version;
		untrack(() => {
			if (pending) clearTimeout(pending);
			pending = null;
			if (v !== drawnVersion) {
				drawnVersion = v;
				draw();
			} else pending = setTimeout(draw, 120);
		});
	});
	$effect(() => () => {
		if (pending) clearTimeout(pending);
	});
</script>

<canvas bind:this={canvas} class="absolute inset-0 size-full" aria-hidden="true"></canvas>
