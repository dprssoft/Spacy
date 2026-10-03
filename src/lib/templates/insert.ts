import * as Y from 'yjs';
import { cloneElements } from '$lib/model/clone';
import { getDocsMap, listElements } from '$lib/model/doc';
import type { Element, Rect } from '$lib/model/types';
import type { BoardContext } from '$lib/board/context';
import { createWithContent } from '$lib/board/commands/edit';
import { definitionOf } from '$lib/board/elements';
import { pureWorld } from '$lib/board/elements/connectables';
import { rectCenter, unionRects } from '$lib/board/engine/geometry';
import { visibleWorldRect } from '$lib/board/engine/viewport';
import { rawStrokes, readStrokes } from '$lib/board/sketch/data';
import type { Template } from './index';

const contains = (outer: Rect, inner: Rect) =>
	inner.x >= outer.x &&
	inner.y >= outer.y &&
	inner.x + inner.w <= outer.x + outer.w &&
	inner.y + inner.h <= outer.y + outer.h;

/** The template's bounds in its own coordinates (connectors included, via their geometry). */
function templateBounds(doc: Y.Doc, els: readonly Element[]): Rect | null {
	const byId = new Map(els.map((e) => [e.id, e]));
	const world = pureWorld(
		(id) => byId.get(id),
		(id) => readStrokes(doc, id)
	);
	return unionRects(els.map((el) => definitionOf(el).aabb(el, world)));
}

/**
 * Adds a template to the board, centered in the view, as one undo step; the new elements are
 * selected. When they don't fit the view, the view zooms out to show them. Returns the new ids.
 */
export async function insertTemplate(ctx: BoardContext, t: Template): Promise<string[]> {
	const temp = new Y.Doc();
	try {
		await t.build(temp);
		const els = listElements(temp);
		const bounds = templateBounds(temp, els);
		if (!bounds) return [];
		const view = visibleWorldRect(ctx.viewport.vp, ctx.viewport.size);
		const from = rectCenter(bounds);
		const to = rectCenter(view);
		const offset = { x: Math.round(to.x - from.x), y: Math.round(to.y - from.y) };
		const { elements, idMap } = cloneElements(els, { offset });

		const fragments = new Map<string, Y.XmlFragment>();
		for (const [oldId, frag] of getDocsMap(temp)) {
			const id = idMap.get(oldId);
			if (id) fragments.set(id, frag);
		}
		const sketches = new Map<string, readonly unknown[]>();
		for (const el of els) {
			const id = idMap.get(el.id);
			if (el.type === 'sketch' && id) sketches.set(id, rawStrokes(temp, el.id));
		}

		ctx.undo.stopCapturing();
		const created = createWithContent(ctx, elements, fragments, sketches);
		ctx.undo.stopCapturing();
		const ids = created.map((e) => e.id);
		ctx.tools.setTool('select');
		ctx.selection.set(ids);

		const placed = { ...bounds, x: bounds.x + offset.x, y: bounds.y + offset.y };
		if (!contains(view, placed)) ctx.viewport.fit(placed);
		return ids;
	} finally {
		temp.destroy();
	}
}
