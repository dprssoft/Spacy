<script lang="ts">
	import type { Element, Point } from '$lib/model/types';
	import { getBoard } from '../context';
	import { PORTS } from '../diagram/connectable';
	import { connectorGeometry } from '../diagram/geometry';
	import { definitionOf } from '../elements';
	import { worldToScreen } from '../engine/viewport';

	const ctx = getBoard();
	const { preview, store, viewport, selection, tools } = ctx;

	const PORT_HIT_PX = 7;
	const toScreen = (p: Point) => worldToScreen(viewport.vp, p);
	const pts = (ps: Point[]) =>
		ps
			.map(toScreen)
			.map((p) => `${p.x},${p.y}`)
			.join(' ');

	const previewD = $derived.by(() => {
		const c = preview.connector;
		if (!c) return null;
		void [viewport.x, viewport.y, viewport.zoom];
		return pts(connectorGeometry(c, store.world).points);
	});

	function connectableEl(id: string | null): Element | null {
		const el = id ? store.get(id) : undefined;
		return el && el.type !== 'connector' && definitionOf(el).connectable ? el : null;
	}

	const target = $derived(connectableEl(preview.connectTarget));
	// Port dots on the hovered element (select tool, not selected: selected ones show resize handles).
	const hovered = $derived.by(() => {
		if (tools.current !== 'select' || selection.transforming || selection.editingId) return null;
		const el = connectableEl(selection.hoverId);
		return el && !selection.has(el.id) && !el.locked ? el : null;
	});

	function portsOf(el: Element | null): { port: string; x: number; y: number }[] {
		if (!el) return [];
		void [viewport.x, viewport.y, viewport.zoom];
		const ports = definitionOf(el).connectable!.ports(el);
		return PORTS.map((port) => ({ port, ...toScreen(ports[port]) }));
	}
	const hoverPorts = $derived(portsOf(hovered));
	const targetPorts = $derived(portsOf(target));
	const targetOutline = $derived.by(() => {
		if (!target) return '';
		void [viewport.x, viewport.y, viewport.zoom];
		return pts(definitionOf(target).connectable!.outline(target));
	});

	// Dragging from a hovered element's port dot starts a connector (handled by the select tool).
	$effect(() =>
		ctx.handles.register((p) => {
			if (!hovered) return null;
			for (const dot of hoverPorts) {
				if (Math.hypot(dot.x - p.x, dot.y - p.y) <= PORT_HIT_PX)
					return `port:${hovered.id}:${dot.port}`;
			}
			return null;
		})
	);
</script>

<svg class="absolute inset-0 size-full overflow-visible" aria-hidden="true">
	{#if target}
		<polygon
			points={targetOutline}
			fill="var(--selection)"
			fill-opacity="0.06"
			stroke="var(--selection)"
			stroke-width="2"
			data-testid="connect-target"
		/>
		{#each targetPorts as d (d.port)}
			<circle cx={d.x} cy={d.y} r="4" fill="white" stroke="var(--selection)" stroke-width="1.5" />
		{/each}
	{/if}
	{#if previewD}
		<polyline
			points={previewD}
			fill="none"
			stroke="var(--selection)"
			stroke-width="2"
			stroke-dasharray="6 4"
			data-testid="connector-preview"
		/>
	{/if}
	{#each hoverPorts as d (d.port)}
		<circle
			cx={d.x}
			cy={d.y}
			r="4.5"
			fill="var(--selection)"
			fill-opacity="0.85"
			stroke="white"
			stroke-width="1.5"
			data-port={d.port}
		/>
	{/each}
</svg>
