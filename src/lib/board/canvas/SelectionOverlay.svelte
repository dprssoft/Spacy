<script lang="ts">
	import Lock from '@lucide/svelte/icons/lock';
	import type { Element, Point } from '$lib/model/types';
	import { getBoard } from '../context';
	import { rectCorners } from '../engine/geometry';
	import { hitHandle, selectionHandles } from '../engine/transform';
	import { worldToScreen } from '../engine/viewport';
	import { connectorGeometry } from '../diagram/geometry';
	import { handleOptions, targetsBox, transformTargets } from '../selectionInfo';

	const ctx = getBoard();
	const { selection, store, viewport, tools } = ctx;

	// Touch and pen need bigger targets: 14 px handles instead of 8.
	const COARSE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
	// Fingers get 44 px hit areas; the rotate handle sits further out so it isn't a resize miss.
	const HANDLE_HIT_RADIUS = COARSE ? 22 : 7;
	/** Half the side of a square handle / radius of a round one. */
	const H = COARSE ? 7 : 4;
	const R = COARSE ? 8 : 5;

	const toScreen = (p: Point) => worldToScreen(viewport.vp, p);
	const outline = (el: Element) =>
		rectCorners(el, el.rotation)
			.map(toScreen)
			.map((p) => `${p.x},${p.y}`)
			.join(' ');

	const selected = $derived(
		[...selection.ids].map((id) => store.get(id)).filter((el): el is Element => !!el)
	);
	const targets = $derived.by(() => {
		void store.version; // re-read after edits (positions change)
		return transformTargets(ctx);
	});
	const box = $derived(targetsBox(targets));
	const opts = $derived(handleOptions(targets));
	const showHandles = $derived(
		tools.current === 'select' && !selection.editingId && !selection.marquee && box !== null
	);
	const handles = $derived(
		showHandles && box
			? selectionHandles(box, toScreen, { ...opts, rotateOffset: COARSE ? 70 : undefined })
			: []
	);
	const boxPolygon = $derived(
		box
			? rectCorners(box, box.rotation)
					.map(toScreen)
					.map((p) => `${p.x},${p.y}`)
					.join(' ')
			: ''
	);
	const allLocked = $derived(selected.length > 0 && selected.every((el) => el.locked));
	const lockBadge = $derived.by(() => {
		if (!allLocked) return null;
		const b = targetsBox(selected);
		return b ? toScreen({ x: b.x + b.w, y: b.y }) : null;
	});
	const hover = $derived.by(() => {
		const id = selection.hoverId;
		if (!id || selection.has(id) || selection.transforming || selection.marquee) return null;
		const el = store.get(id);
		return el && el.type !== 'connector' ? el : null;
	});
	const marqueeRect = $derived.by(() => {
		const m = selection.marquee;
		if (!m) return null;
		const a = toScreen({ x: m.x, y: m.y });
		return { x: a.x, y: a.y, w: m.w * viewport.zoom, h: m.h * viewport.zoom };
	});

	const screenRect = (r: { x: number; y: number; w: number; h: number }) => {
		const a = toScreen({ x: r.x, y: r.y });
		return { x: a.x, y: a.y, w: r.w * viewport.zoom, h: r.h * viewport.zoom };
	};
	const selectedConnectors = $derived(selected.filter((el) => el.type === 'connector'));
	const connectorLines = $derived.by(() => {
		void [viewport.x, viewport.y, viewport.zoom];
		return selectedConnectors.map((c) => {
			const g = connectorGeometry(c as Extract<Element, { type: 'connector' }>, store.world);
			return {
				id: c.id,
				points: g.points
					.map(toScreen)
					.map((p) => `${p.x},${p.y}`)
					.join(' '),
				start: toScreen(g.start),
				end: toScreen(g.end),
				label: g.label ? screenRect(g.label) : null,
				locked: c.locked
			};
		});
	});
	// A single selected connector gets draggable end handles.
	const endHandles = $derived(
		tools.current === 'select' &&
			connectorLines.length === 1 &&
			selected.length === 1 &&
			!connectorLines[0]!.locked
			? [
					{ id: 'end:from', ...connectorLines[0]!.start },
					{ id: 'end:to', ...connectorLines[0]!.end }
				]
			: []
	);

	// Bends of a single selected connector: elbow segments slide; straight/curve get insert + move handles.
	const bendHandles = $derived.by(() => {
		if (endHandles.length === 0) return [];
		const c = selectedConnectors[0];
		if (c?.type !== 'connector') return [];
		void [viewport.x, viewport.y, viewport.zoom];
		const g = connectorGeometry(c, store.world);
		const mid = (a: { x: number; y: number }, b: { x: number; y: number }) =>
			toScreen({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
		if (c.routing === 'elbow') {
			const pts = g.points;
			const out: { id: string; x: number; y: number; round: boolean }[] = [];
			for (let i = 1; i + 2 < pts.length; i++)
				out.push({ id: `bend:${i}`, ...mid(pts[i]!, pts[i + 1]!), round: false });
			return out;
		}
		const control = [g.start, ...c.waypoints, g.end];
		return [
			...control
				.slice(0, -1)
				.map((p, i) => ({ id: `bend:${i}`, ...mid(p, control[i + 1]!), round: false })),
			...c.waypoints.map((w, i) => ({ id: `wp:${i}`, ...toScreen(w), round: true }))
		];
	});

	// Handles are hit-tested before elements by the pointer router.
	$effect(() =>
		ctx.handles.register((p) => {
			for (const h of endHandles)
				if (Math.hypot(h.x - p.x, h.y - p.y) <= HANDLE_HIT_RADIUS) return h.id;
			for (const h of bendHandles)
				if (Math.hypot(h.x - p.x, h.y - p.y) <= HANDLE_HIT_RADIUS) return h.id;
			// A selected connector's label can be dragged along the path.
			const l = endHandles.length ? connectorLines[0]?.label : null;
			if (l && p.x >= l.x && p.x <= l.x + l.w && p.y >= l.y && p.y <= l.y + l.h) return 'label';
			return handles.length ? hitHandle(handles, p, HANDLE_HIT_RADIUS) : null;
		})
	);

	// One path for every selected element's outline: a polygon each re-rendered hundreds of
	// elements per frame while dragging a big selection.
	const memberOutlines = $derived(
		selected.length > 1
			? selected
					.filter((el) => el.type !== 'connector')
					.map((el) => `M${outline(el)}Z`)
					.join('')
			: ''
	);

	const rotationDeg = $derived(box ? (box.rotation * 180) / Math.PI : 0);
</script>

<svg class="absolute inset-0 size-full overflow-visible" aria-hidden="true">
	{#if hover}
		<polygon
			points={outline(hover)}
			fill="none"
			stroke="var(--selection)"
			stroke-opacity="0.5"
			stroke-width="1.5"
		/>
	{/if}
	{#if memberOutlines}
		<path d={memberOutlines} fill="none" stroke="var(--selection)" stroke-width="1" />
	{/if}
	{#if box && !selection.editingId}
		<polygon points={boxPolygon} fill="none" stroke="var(--selection)" stroke-width="1.5" />
	{/if}
	{#each connectorLines as line (line.id)}
		<polyline
			points={line.points}
			fill="none"
			stroke="var(--selection)"
			stroke-width="1.5"
			stroke-opacity="0.6"
		/>
	{/each}
	{#each bendHandles as h (h.id)}
		{#if h.round}
			<circle
				cx={h.x}
				cy={h.y}
				r={H}
				fill="var(--selection)"
				stroke="white"
				stroke-width="1.5"
				data-handle={h.id}
			/>
		{:else}
			<rect
				x={h.x - H}
				y={h.y - H}
				width={H * 2}
				height={H * 2}
				transform="rotate(45 {h.x} {h.y})"
				fill="white"
				stroke="var(--selection)"
				stroke-width="1.5"
				data-handle={h.id}
			/>
		{/if}
	{/each}
	{#each endHandles as h (h.id)}
		<circle
			cx={h.x}
			cy={h.y}
			r={R}
			fill="white"
			stroke="var(--selection)"
			stroke-width="1.5"
			data-handle={h.id}
		/>
	{/each}
	{#if marqueeRect}
		<rect
			x={marqueeRect.x}
			y={marqueeRect.y}
			width={marqueeRect.w}
			height={marqueeRect.h}
			fill="var(--selection)"
			fill-opacity="0.08"
			stroke="var(--selection)"
			stroke-width="1"
			data-testid="marquee"
		/>
	{/if}
	{#each handles as h (h.id)}
		{#if h.id === 'rotate'}
			<circle
				cx={h.x}
				cy={h.y}
				r={R}
				fill="white"
				stroke="var(--selection)"
				stroke-width="1.5"
				data-handle="rotate"
			/>
		{:else}
			<rect
				x={h.x - H}
				y={h.y - H}
				width={H * 2}
				height={H * 2}
				rx="1.5"
				fill="white"
				stroke="var(--selection)"
				stroke-width="1.5"
				transform="rotate({rotationDeg} {h.x} {h.y})"
				data-handle={h.id}
			/>
		{/if}
	{/each}
</svg>
{#if lockBadge}
	<div
		class="absolute flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-muted shadow"
		style:left="{lockBadge.x}px"
		style:top="{lockBadge.y}px"
		title="Locked"
	>
		<Lock class="size-3" aria-hidden="true" />
	</div>
{/if}
