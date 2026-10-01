<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import type { Element, Port } from '$lib/model/types';
	import { getBoard } from '../context';
	import { PORTS } from '../diagram/connectable';
	import { quickCreate, type QuickKind } from '../diagram/quickCreate';
	import { definitionOf } from '../elements';
	import { SHAPE_KINDS } from '../elements/shape/paths';
	import { worldToScreen } from '../engine/viewport';

	const ctx = getBoard();
	const { selection, store, viewport, tools } = ctx;
	const OFFSET_PX = 22;

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
		title="Add connected element (Shift: choose type)"
		class="pointer-events-auto absolute flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-accent-contrast opacity-70 shadow transition hover:scale-110 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
		style:left="{b.x}px"
		style:top="{b.y}px"
		onpointerdown={(e) => e.stopPropagation()}
		onclick={(e) => (e.shiftKey ? (picker = { port: b.port, x: b.x, y: b.y }) : create(b.port))}
	>
		<Plus class="size-3.5" aria-hidden="true" />
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
