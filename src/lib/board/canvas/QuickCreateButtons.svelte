<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import type { Element, Point, Port } from '$lib/model/types';
	import { getBoard } from '../context';
	import { PORTS } from '../diagram/connectable';
	import { createConnectGesture } from '../diagram/connectGesture';
	import { makeEndpoint } from '../diagram/endpoints';
	import { quickCreate, type QuickKind } from '../diagram/quickCreate';
	import { definitionOf } from '../elements';
	import { SHAPE_KINDS } from '../elements/shape/paths';
	import { screenToWorld, worldToScreen } from '../engine/viewport';

	const ctx = getBoard();
	const { selection, store, viewport, tools } = ctx;
	// Touch: further out (bigger buttons), still inside the rotate handle (70 px).
	const OFFSET_PX =
		typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 30 : 22;

	const usable = (el: Element | undefined): el is Element =>
		!!el && el.type !== 'connector' && !el.locked && !!definitionOf(el).connectable;

	// After the pointer leaves a hovered element, keep its buttons briefly so they can be reached
	// (they sit outside the element, across a small gap).
	const LINGER_MS = 700;
	let lingering = $state<string | null>(null);
	$effect(() => {
		const id = selection.hoverId;
		if (id) {
			lingering = id;
			return;
		}
		const t = setTimeout(() => (lingering = null), LINGER_MS);
		return () => clearTimeout(t);
	});

	const source = $derived.by((): Element | null => {
		// While a connection is being dragged from a button, stay on the element it started from.
		if (drag) return store.get(drag.sourceId) ?? null;
		if (
			tools.current !== 'select' ||
			selection.transforming ||
			selection.editingId ||
			selection.marquee
		)
			return null;
		const single = selection.single ? store.get(selection.single) : undefined;
		if (selection.size > 0) return usable(single) ? single : null;
		const id = selection.hoverId ?? lingering;
		const hovered = id ? store.get(id) : undefined;
		return usable(hovered) ? hovered : null;
	});

	const buttons = $derived.by(() => {
		if (!source) return [];
		void [viewport.x, viewport.y, viewport.zoom];
		const c = definitionOf(source).connectable!;
		const ports = c.ports(source);
		// On a selected element the rotate handle and the style popover occupy the top: no "+" there
		// (Mod+Alt+Up still works).
		const selected = selection.size > 0;
		return PORTS.filter((port) => !(selected && port === 'n')).map((port) => {
			const p = worldToScreen(viewport.vp, ports[port]);
			const n = c.portNormal(source, port);
			return { port, x: p.x + n.x * OFFSET_PX, y: p.y + n.y * OFFSET_PX };
		});
	});

	let picker = $state<{ port: Port; x: number; y: number } | null>(null);
	$effect(() => {
		if (!source) picker = null;
	});

	const LABELS: Record<Port, string> = { n: 'above', e: 'right', s: 'below', w: 'left' };

	// Dragging a "+" draws a connector from that side to whatever it's dropped on (any type of
	// object); a plain click adds a connected copy instead.
	const DRAG_THRESHOLD_PX = 5;
	let drag = $state<{
		sourceId: string;
		port: Port;
		start: Point;
		gesture: ReturnType<typeof createConnectGesture> | null;
	} | null>(null);
	let suppressClick = false;

	/** Pointer position on the canvas (screen) and in the world. */
	function locate(e: PointerEvent) {
		const r = (e.currentTarget as HTMLElement).offsetParent?.getBoundingClientRect();
		const screen = { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
		return { screen, world: screenToWorld(viewport.vp, screen) };
	}

	function onpointerdown(e: PointerEvent, port: Port) {
		e.stopPropagation();
		if (e.button !== 0 || !source) return;
		suppressClick = false;
		drag = { sourceId: source.id, port, start: locate(e).screen, gesture: null };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onpointermove(e: PointerEvent) {
		if (!drag) return;
		const { screen, world } = locate(e);
		if (!drag.gesture) {
			if (Math.hypot(screen.x - drag.start.x, screen.y - drag.start.y) < DRAG_THRESHOLD_PX) return;
			const el = store.get(drag.sourceId);
			const c = el ? definitionOf(el).connectable : null;
			if (!el || !c) return;
			picker = null;
			const from = makeEndpoint(el, c, c.ports(el)[drag.port], 'auto', 1);
			drag.gesture = createConnectGesture(ctx, from, drag.start);
		}
		drag.gesture.move(world, e.altKey);
	}

	function onpointerup(e: PointerEvent) {
		const d = drag;
		drag = null;
		if (!d?.gesture) return;
		suppressClick = true; // the click that follows a drag isn't a "create a copy"
		const { screen, world } = locate(e);
		const id = d.gesture.finish(world, screen, e.altKey);
		if (id) selection.set([id]);
	}

	function oncancel() {
		drag?.gesture?.cancel();
		drag = null;
	}

	function onclick(e: MouseEvent, b: { port: Port; x: number; y: number }) {
		if (suppressClick) {
			suppressClick = false;
			return;
		}
		if (e.shiftKey) picker = { port: b.port, x: b.x, y: b.y };
		else create(b.port);
	}

	function create(port: Port, override?: QuickKind) {
		if (!source) return;
		const id = quickCreate(ctx, source.id, port, override);
		picker = null;
		if (!id) return;
		const el = store.get(id);
		selection.set([id]);
		if (el && definitionOf(el).editableText && el.type !== 'frame') {
			ctx.editing.start(id, { discardIfEmpty: el.type === 'text' });
		}
	}

	const choices: { label: string; kind: QuickKind }[] = [
		...SHAPE_KINDS.map((k) => ({
			label: k.label,
			kind: { type: 'shape', kind: k.kind } as QuickKind
		})),
		{ label: 'Sticky note', kind: { type: 'sticky' } },
		{ label: 'Text', kind: { type: 'text' } },
		{ label: 'Doc card', kind: { type: 'doccard' } }
	];
</script>

{#each buttons as b (b.port)}
	<button
		type="button"
		data-interactive
		data-quick-create={b.port}
		aria-label="Add connected element {LABELS[b.port]}"
		title="Drag to connect to another object · Click to add a connected copy · Shift+click to choose its type"
		class="pointer-events-auto absolute flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-accent-contrast opacity-70 shadow transition hover:scale-110 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none pointer-coarse:size-9"
		class:invisible={drag?.gesture != null}
		style:left="{b.x}px"
		style:top="{b.y}px"
		onpointerdown={(e) => onpointerdown(e, b.port)}
		{onpointermove}
		{onpointerup}
		onpointercancel={oncancel}
		onclick={(e) => onclick(e, b)}
	>
		<Plus class="size-3.5 pointer-coarse:size-5" aria-hidden="true" />
	</button>
{/each}

{#if picker}
	{@const p = picker}
	<div
		role="menu"
		aria-label="Add connected"
		data-interactive
		class="pointer-events-auto absolute z-40 grid max-h-72 w-44 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-lg"
		style:left="{p.x + 12}px"
		style:top="{p.y + 12}px"
	>
		{#each choices as c (c.label)}
			<button
				type="button"
				role="menuitem"
				class="h-7 rounded-md px-2 text-left text-sm hover:bg-surface-2"
				onclick={() => create(p.port, c.kind)}
			>
				{c.label}
			</button>
		{/each}
	</div>
{/if}
