import { updateElements } from '$lib/model/ops';
import type {
	Element,
	ElementPatch,
	Marker,
	Point,
	Routing,
	ShapeKind,
	Style
} from '$lib/model/types';
import type { BoardContext } from '../context';

export type StylePatch = Partial<Omit<Style, 'font'>> & { font?: Partial<Style['font']> };

export interface AppearancePatch {
	style?: StylePatch;
	/** Shapes only. */
	kind?: ShapeKind;
	/** Stickies only. */
	color?: string;
	/** Connectors only. */
	routing?: Routing;
	markerStart?: Marker;
	markerEnd?: Marker;
	labelBackground?: boolean;
	waypoints?: Point[];
}

export function mergeStyle(style: Style, patch: StylePatch): Style {
	return { ...style, ...patch, font: { ...style.font, ...patch.font } };
}

/** The element patch for one element (fields that don't apply to its type are ignored). */
export function appearancePatch(el: Element, patch: AppearancePatch): ElementPatch {
	const out: ElementPatch = {};
	if (patch.style) out.style = mergeStyle(el.style, patch.style);
	if (patch.kind && el.type === 'shape') out.kind = patch.kind;
	if (patch.color && el.type === 'sticky') out.color = patch.color;
	if (el.type === 'connector') {
		if (patch.routing) out.routing = patch.routing;
		if (patch.waypoints) out.waypoints = patch.waypoints;
		if (patch.markerStart) out.markerStart = patch.markerStart;
		if (patch.markerEnd) out.markerEnd = patch.markerEnd;
		if (patch.labelBackground !== undefined)
			out.label = { ...el.label, background: patch.labelBackground };
	}
	return out;
}

/**
 * Applies an appearance change to elements in one transaction. Discrete changes are their own undo
 * step; with `continuous` (slider drags) consecutive changes merge via the capture window.
 */
export function applyStyle(
	ctx: BoardContext,
	ids: Iterable<string>,
	patch: AppearancePatch,
	opts: { continuous?: boolean } = {}
): void {
	const patches = [...ids].flatMap((id) => {
		const el = ctx.store.get(id);
		return el ? [{ id, patch: appearancePatch(el, patch) }] : [];
	});
	if (patches.length === 0) return;
	if (!opts.continuous) ctx.undo.stopCapturing();
	updateElements(ctx.doc, patches);
	if (!opts.continuous) ctx.undo.stopCapturing();
}
