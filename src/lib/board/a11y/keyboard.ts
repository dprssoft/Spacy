import { DEFAULT_SIZES } from '$lib/model/defaults';
import type { BoardContext } from '../context';
import { definitionOf } from '../elements';
import { screenToWorld, visibleWorldRect } from '../engine/viewport';
import { syncFrameMembership } from '../frameMembership';
import { createDocCard, createShapeAt, createSticky, createText } from '../tools/create';
import { createFrame } from '../tools/frame';
import type { ToolId } from '../tools/types';
import { nextInOrder, readingOrder } from './readingOrder';

export const CREATION_TOOLS: readonly ToolId[] = ['shape', 'sticky', 'text', 'doccard', 'frame'];

/**
 * Keyboard creation: with a creation tool active, makes its element at the center of the view and
 * selects it (one undo step). Returns the new id, or null when the tool doesn't create by click.
 */
export function createAtCenter(ctx: BoardContext): string | null {
	const tool = ctx.tools.current;
	if (!CREATION_TOOLS.includes(tool)) return null;
	const at = screenToWorld(ctx.viewport.vp, ctx.viewport.center);
	ctx.undo.stopCapturing();
	let id: string;
	if (tool === 'shape') id = createShapeAt(ctx, ctx.tools.shapeKind, at);
	else if (tool === 'sticky') id = createSticky(ctx, at);
	else if (tool === 'text') id = createText(ctx, at);
	else if (tool === 'doccard') id = createDocCard(ctx, at);
	else {
		const { w, h } = DEFAULT_SIZES.frame;
		id = createFrame(ctx, { x: at.x - w / 2, y: at.y - h / 2, w, h });
	}
	syncFrameMembership(ctx, [id]);
	ctx.undo.stopCapturing();
	ctx.tools.returnToSelect();
	// An empty text is invisible: go straight to typing (it disappears if left empty).
	if (tool === 'text') ctx.editing.start(id, { discardIfEmpty: true });
	else ctx.selection.set([id]);
	return id;
}

/**
 * Tab / Shift+Tab: selects the next element in reading order among those in view (or on the whole
 * board when none is), bringing it into view. Returns false past either end, so focus moves on.
 */
export function cycleSelection(ctx: BoardContext, back: boolean): boolean {
	const { store, viewport, selection } = ctx;
	const view = visibleWorldRect(viewport.vp, viewport.size);
	const bounds = (id: string) => {
		const el = store.get(id);
		return el && !el.locked ? { id, rect: definitionOf(el).aabb(el, store.world) } : null;
	};
	let items = store.index.search(view).flatMap((id) => bounds(id) ?? []);
	if (items.length === 0) items = [...store.elements.keys()].flatMap((id) => bounds(id) ?? []);
	const next = nextInOrder(readingOrder(items), selection.single, back);
	if (!next) return false;
	selection.set([next]);
	const rect = items.find((i) => i.id === next)!.rect;
	const inView =
		rect.x >= view.x &&
		rect.y >= view.y &&
		rect.x + rect.w <= view.x + view.w &&
		rect.y + rect.h <= view.y + view.h;
	if (!inView) {
		// Center it, keeping the zoom.
		const c = viewport.center;
		viewport.animateTo({
			x: c.x - (rect.x + rect.w / 2) * viewport.zoom,
			y: c.y - (rect.y + rect.h / 2) * viewport.zoom,
			zoom: viewport.zoom
		});
	}
	return true;
}
