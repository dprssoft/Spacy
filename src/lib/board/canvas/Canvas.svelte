<script lang="ts">
	import type { Snippet } from 'svelte';
	import { debounce } from '$lib/shared/debounce';
	import * as boardsRepo from '$lib/storage/boardsRepo';
	import { cycleSelection } from '../a11y/keyboard';
	import { getBoard } from '../context';
	import { centeredOrigin, fitRect, screenToWorld } from '../engine/viewport';
	import { canImport, importFiles } from '../files/importFiles';
	import { SHAPE_DRAG_TYPE, SHAPE_KINDS } from '../elements/shape/paths';
	import { createShapeAt } from '../tools/create';
	import { syncFrameMembership } from '../frameMembership';
	import { pointerRouter } from '../tools/pointerRouter';
	import { theme } from '$lib/shared/theme.svelte';
	import { gridGap, gridTileSize, gridTileUrl } from './grid';
	import { viewportInput } from './viewportInput';

	let {
		world,
		overlay
	}: {
		/** Content in world coordinates (scaled and translated with the viewport). */
		world?: Snippet;
		/** Content in screen coordinates (selection handles, guides…). */
		overlay?: Snippet;
	} = $props();

	const ctx = getBoard();
	const { id, viewport } = ctx;

	let container = $state<HTMLDivElement>();
	let panning = $state(false);
	let spaceHeld = $state(false);
	let restored = false;

	// Track the container size; on first measure, restore the saved view (or center the origin).
	$effect(() => {
		if (!container) return;
		const observer = new ResizeObserver(([entry]) => {
			if (!entry) return;
			viewport.size = { w: entry.contentRect.width, h: entry.contentRect.height };
			if (!restored) {
				restored = true;
				void boardsRepo.get(id).then((meta) => {
					// A saved view, else fit what's there (a template, an import), else the origin.
					const content = ctx.store.contentBounds();
					viewport.set(
						meta?.viewport ??
							(content ? fitRect(content, viewport.size, 64, 1) : centeredOrigin(viewport.size))
					);
				});
			}
		});
		observer.observe(container);
		return () => observer.disconnect();
	});

	// Remember the view per board.
	const saveViewport = debounce(() => {
		void boardsRepo.setViewport(id, viewport.vp);
	}, 500);
	$effect(() => {
		void [viewport.x, viewport.y, viewport.zoom];
		if (restored) saveViewport();
	});
	$effect(() => () => saveViewport.flush());

	// Files dropped onto the canvas (images, text, Markdown, Word) land where they were dropped.
	let dropping = $state(false);
	const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files');
	const hasShape = (e: DragEvent) => !!e.dataTransfer?.types.includes(SHAPE_DRAG_TYPE);

	function ondragover(e: DragEvent) {
		if (hasShape(e)) {
			e.preventDefault();
			if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
			return;
		}
		if (!hasFiles(e)) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
		dropping = true;
	}

	function ondrop(e: DragEvent) {
		if (hasShape(e) && container) {
			e.preventDefault();
			const kind = SHAPE_KINDS.find(
				(k) => k.kind === e.dataTransfer?.getData(SHAPE_DRAG_TYPE)
			)?.kind;
			if (!kind) return;
			const r = container.getBoundingClientRect();
			const at = screenToWorld(viewport.vp, { x: e.clientX - r.left, y: e.clientY - r.top });
			ctx.undo.stopCapturing();
			const id = createShapeAt(ctx, kind, at);
			syncFrameMembership(ctx, [id]);
			ctx.undo.stopCapturing();
			ctx.tools.setTool('select');
			ctx.selection.set([id]);
			return;
		}
		if (!hasFiles(e) || !container) return;
		e.preventDefault();
		dropping = false;
		const files = [...(e.dataTransfer?.files ?? [])].filter(canImport);
		if (files.length === 0) return;
		const r = container.getBoundingClientRect();
		const at = screenToWorld(viewport.vp, { x: e.clientX - r.left, y: e.clientY - r.top });
		void importFiles(ctx, files, at);
	}

	// Tab on the canvas itself walks through the objects; past the last one, focus moves on.
	function onkeydown(e: KeyboardEvent) {
		if (e.key !== 'Tab' || e.target !== container || e.ctrlKey || e.metaKey || e.altKey) return;
		if (ctx.selection.editingId || ctx.tools.current !== 'select') return;
		if (cycleSelection(ctx, e.shiftKey)) e.preventDefault();
		else ctx.selection.clear();
	}

	const gridSize = $derived(gridGap(viewport.zoom));

	// The dot color comes from the theme's CSS variable, read once per theme (not per pan). Read
	// again a frame later too: the theme attribute on <html> may update after this effect.
	let dotColor = $state('');
	$effect(() => {
		void theme.resolved;
		const node = container;
		if (!node) return;
		const read = () => (dotColor = getComputedStyle(node).getPropertyValue('--canvas-dot').trim());
		read();
		const raf = requestAnimationFrame(read);
		return () => cancelAnimationFrame(raf);
	});
	const gridImage = $derived(
		ctx.prefs.grid && dotColor && !viewport.sceneCanvas
			? gridTileUrl(gridTileSize(gridSize), dotColor)
			: undefined
	);
</script>

<!-- The canvas is a focusable application region: it must receive keyboard shortcuts. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
	bind:this={container}
	{@attach viewportInput(viewport, {
		onPanningChange: (p, s) => {
			panning = p;
			spaceHeld = s;
		}
	})}
	class="relative h-full w-full touch-none overflow-hidden overscroll-none outline-none select-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-inset"
	{@attach pointerRouter(ctx)}
	style:cursor={panning ? 'grabbing' : spaceHeld ? 'grab' : ctx.tools.tool.cursor}
	style:background-image={gridImage}
	style:background-size="{gridSize}px {gridSize}px"
	style:background-position="{viewport.x}px {viewport.y}px"
	{ondragover}
	ondragleave={() => (dropping = false)}
	{ondrop}
	{onkeydown}
	role="application"
	aria-roledescription="whiteboard"
	aria-label="Board canvas"
	aria-describedby="canvas-help"
	tabindex="0"
	data-testid="canvas"
>
	<!-- No will-change: a promoted layer this large, scaled down, is re-rastered on every pan
	     (measured: 1,038 → 75 ms/frame with 3,000 visible elements; no cost at 100% zoom). -->
	<div
		class="absolute top-0 left-0 origin-top-left"
		style:transform="translate({viewport.x}px, {viewport.y}px) scale({viewport.zoom})"
		data-testid="world"
	>
		{@render world?.()}
	</div>
	<div class="pointer-events-none absolute inset-0">
		{@render overlay?.()}
	</div>
	{#if dropping}
		<div
			class="pointer-events-none absolute inset-2 rounded-xl border-2 border-dashed border-accent bg-accent/5"
			aria-hidden="true"
		></div>
	{/if}
</div>

<p id="canvas-help" class="sr-only">
	Use tools from the toolbar. Press Enter to create with the active tool, Tab to move between
	objects. Press ? for keyboard shortcuts.
</p>
