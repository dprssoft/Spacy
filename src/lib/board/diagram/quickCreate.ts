import { newElementBase, STICKY_COLORS } from '$lib/model/defaults';
import { newId } from '$lib/model/ids';
import { createElements } from '$lib/model/ops';
import { LOCAL } from '$lib/model/origins';
import type { Element, NewElement, Port, Rect, ShapeKind } from '$lib/model/types';
import type { BoardContext } from '../context';
import { definitionOf } from '../elements';
import { rectsIntersect } from '../engine/geometry';
import { syncFrameMembership } from '../frameMembership';
import { getDefaultStyle } from '../style/styleDefaults';
import { makeEndpoint } from './endpoints';
import { newConnector } from './ops';

const GAP = 80;
const MAX_TRIES = 5;
const OPPOSITE: Record<Port, Port> = { n: 's', s: 'n', e: 'w', w: 'e' };
const DIR: Record<Port, { x: number; y: number }> = {
	n: { x: 0, y: -1 },
	s: { x: 0, y: 1 },
	e: { x: 1, y: 0 },
	w: { x: -1, y: 0 }
};

export type QuickKind =
	{ type: 'shape'; kind: ShapeKind } | { type: 'sticky' } | { type: 'text' } | { type: 'doccard' };

/**
 * Where the new element goes: `GAP` away from the source in `dir`, aligned on its center line;
 * shifted sideways (by its size + 40) while it would overlap something, up to 5 times.
 */
export function quickPlacement(
	source: Rect,
	size: { w: number; h: number },
	dir: Port,
	occupied: (r: Rect) => boolean
): Rect {
	const d = DIR[dir];
	const cx = source.x + source.w / 2;
	const cy = source.y + source.h / 2;
	let rect: Rect = {
		x: d.x === 0 ? cx - size.w / 2 : d.x > 0 ? source.x + source.w + GAP : source.x - GAP - size.w,
		y: d.y === 0 ? cy - size.h / 2 : d.y > 0 ? source.y + source.h + GAP : source.y - GAP - size.h,
		w: size.w,
		h: size.h
	};
	for (let i = 0; i < MAX_TRIES && occupied(rect); i++) {
		rect = d.x !== 0 ? { ...rect, y: rect.y + size.h + 40 } : { ...rect, x: rect.x + size.w + 40 };
	}
	return rect;
}

/** The new element's type: the same as the source, unless overridden (images → sticky, strokes → rectangle). */
function newFor(source: Element, rect: Rect, override?: QuickKind): NewElement {
	const id = newId();
	const at = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
	const want: QuickKind =
		override ??
		(source.type === 'shape'
			? { type: 'shape', kind: source.kind }
			: source.type === 'sticky' || source.type === 'text' || source.type === 'doccard'
				? { type: source.type }
				: source.type === 'image'
					? { type: 'sticky' }
					: { type: 'shape', kind: 'rect' });
	const sameType = !override && want.type === source.type;
	const style = sameType ? structuredClone(source.style) : getDefaultStyle(want.type);
	const base = { ...newElementBase(want.type, id, at, style), ...rect };
	switch (want.type) {
		case 'shape':
			return { ...base, type: 'shape', kind: want.kind, text: '' };
		case 'sticky':
			return {
				...base,
				type: 'sticky',
				text: '',
				color: source.type === 'sticky' ? source.color : STICKY_COLORS.yellow
			};
		case 'text':
			return { ...base, type: 'text', text: '', autoWidth: true };
		case 'doccard':
			return { ...base, type: 'doccard', title: 'Untitled', collapsed: false, expandedH: rect.h };
	}
}

/** Size of the new element: the source's size when the type matches, else the type's default. */
function sizeFor(source: Element, override?: QuickKind): { w: number; h: number } {
	if (source.type === 'frame' && !override) return { w: source.w, h: source.h };
	const keep = !override && ['shape', 'sticky', 'doccard'].includes(source.type);
	if (keep) return { w: source.w, h: source.h };
	const probe = newFor(source, { x: 0, y: 0, w: 0, h: 0 }, override);
	const defaults = newElementBase(probe.type, 'probe', { x: 0, y: 0 });
	return { w: defaults.w, h: defaults.h };
}

/**
 * Creates a connected neighbour of `sourceId` in direction `dir` (one undo step) and selects it.
 * Frames duplicate as same-size frames. Returns the new element's id.
 */
export function quickCreate(
	ctx: BoardContext,
	sourceId: string,
	dir: Port,
	override?: QuickKind
): string | null {
	const source = ctx.store.get(sourceId);
	const sc = source ? definitionOf(source).connectable : null;
	if (!source || !sc) return null;
	const box = ctx.store.index.get(sourceId) ?? source;
	const size = sizeFor(source, override);
	const rect = quickPlacement(box, size, dir, (r) =>
		ctx.store.index
			.search(r)
			.some(
				(id) =>
					id !== sourceId &&
					ctx.store.get(id)?.type !== 'connector' &&
					rectsIntersect(r, ctx.store.index.get(id)!)
			)
	);
	const el: NewElement =
		source.type === 'frame' && !override
			? {
					...newElementBase('frame', newId(), { x: 0, y: 0 }, structuredClone(source.style)),
					...rect,
					type: 'frame',
					title: 'Frame'
				}
			: newFor(source, rect, override);

	ctx.undo.stopCapturing();
	let createdId = '';
	ctx.doc.transact(() => {
		const [created] = createElements(ctx.doc, [el]);
		createdId = created!.id;
		const tc = definitionOf(created!).connectable!;
		const from = makeEndpoint(source, sc, sc.ports(source)[dir], 'auto', 1);
		const to = makeEndpoint(created!, tc, tc.ports(created!)[OPPOSITE[dir]], 'auto', 1);
		createElements(ctx.doc, [newConnector(from, to)]);
	}, LOCAL);
	syncFrameMembership(ctx, [createdId]);
	return createdId;
}

/** Elements and connectors reachable from `ids` through connectors. */
export function connectedComponent(ctx: BoardContext, ids: Iterable<string>): string[] {
	const seen = new Set<string>();
	const queue = [...ids];
	while (queue.length) {
		const id = queue.pop()!;
		if (seen.has(id)) continue;
		const el = ctx.store.get(id);
		if (!el) continue;
		seen.add(id);
		if (el.type === 'connector') {
			for (const ep of [el.from, el.to]) if (ep.kind !== 'free') queue.push(ep.elementId);
		} else {
			queue.push(...ctx.store.connectorsOf(id));
		}
	}
	return [...seen];
}
