<script lang="ts">
	import type { Snippet } from 'svelte';
	import { GRID_SIZE } from '$lib/model/defaults';
	import type { Rect } from '$lib/model/types';
	import { debounce } from '$lib/shared/debounce';
	import { getPref } from '$lib/shared/localPrefs';
	import * as boardsRepo from '$lib/storage/boardsRepo';
	import { getBoard } from '../context';
	import { centeredOrigin, nextZoomStep, zoomAt } from '../engine/viewport';
	import ZoomControls from '../ui/ZoomControls.svelte';
	import { viewportInput } from './viewportInput';

	let {
		world,
		overlay,
		contentBounds = () => null
	}: {
		/** Content in world coordinates (scaled and translated with the viewport). */
		world?: Snippet;
		/** Content in screen coordinates (selection handles, guides…). */
		overlay?: Snippet;
		contentBounds?: () => Rect | null;
	} = $props();

	const { id, viewport } = getBoard();

	let container = $state<HTMLDivElement>();
	let panning = $state(false);
	let spaceHeld = $state(false);
	let restored = false;
	const showGrid = getPref('grid', true);

	// Track the container size; on first measure, restore the saved view (or center the origin).
	$effect(() => {
		if (!container) return;
		const observer = new ResizeObserver(([entry]) => {
			if (!entry) return;
			viewport.size = { w: entry.contentRect.width, h: entry.contentRect.height };
			if (!restored) {
				restored = true;
				void boardsRepo.get(id).then((meta) => {
					viewport.set(meta?.viewport ?? centeredOrigin(viewport.size));
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

	function isTyping(t: EventTarget | null): boolean {
		return (
			t instanceof HTMLElement &&
			(t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))
		);
	}

	// View shortcuts. Step 11 moves these into the shortcut registry.
	function onKeydown(e: KeyboardEvent) {
		if (isTyping(e.target)) return;
		const mod = e.ctrlKey || e.metaKey;
		if (e.shiftKey && !mod && e.code === 'Digit1') {
			e.preventDefault();
			viewport.fit(contentBounds());
		} else if (e.shiftKey && !mod && e.code === 'Digit0') {
			e.preventDefault();
			viewport.reset100();
		} else if (mod && (e.key === '=' || e.key === '+')) {
			e.preventDefault();
			viewport.animateTo(zoomAt(viewport.vp, viewport.center, nextZoomStep(viewport.zoom, 1)));
		} else if (mod && e.key === '-') {
			e.preventDefault();
			viewport.animateTo(zoomAt(viewport.vp, viewport.center, nextZoomStep(viewport.zoom, -1)));
		} else if (mod && e.key === '0') {
			e.preventDefault(); // browser zoom reset
			viewport.reset100();
		}
	}

	const gridSize = $derived(
		GRID_SIZE * viewport.zoom < 8 ? GRID_SIZE * 4 * viewport.zoom : GRID_SIZE * viewport.zoom
	);
</script>

<svelte:window onkeydown={onKeydown} />

<!-- The canvas is a focusable application region: it must receive keyboard shortcuts. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	bind:this={container}
	{@attach viewportInput(viewport, {
		onPanningChange: (p, s) => {
			panning = p;
			spaceHeld = s;
		}
	})}
	class="relative h-full w-full touch-none overflow-hidden overscroll-none select-none"
	class:cursor-grab={spaceHeld && !panning}
	class:cursor-grabbing={panning}
	style:background-image={showGrid
		? 'radial-gradient(var(--canvas-dot) 1px, transparent 1px)'
		: undefined}
	style:background-size="{gridSize}px {gridSize}px"
	style:background-position="{viewport.x}px {viewport.y}px"
	role="application"
	aria-label="Board canvas"
	tabindex="0"
	data-testid="canvas"
>
	<div
		class="absolute top-0 left-0 origin-top-left will-change-transform"
		style:transform="translate({viewport.x}px, {viewport.y}px) scale({viewport.zoom})"
		data-testid="world"
	>
		{@render world?.()}
	</div>
	<div class="pointer-events-none absolute inset-0">
		{@render overlay?.()}
	</div>
</div>

<ZoomControls {viewport} {contentBounds} />
