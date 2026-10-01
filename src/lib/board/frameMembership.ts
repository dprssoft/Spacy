import { deleteElements, updateElements } from '$lib/model/ops';
import { LOCAL } from '$lib/model/origins';
import type { Element, ElementPatch, FrameElement, Rect } from '$lib/model/types';
import type { BoardContext } from './context';
import { frameFor } from './engine/frames';

function frames(ctx: BoardContext): FrameElement[] {
	return ctx.store.frameOrder
		.map((id) => ctx.store.get(id))
		.filter((el): el is FrameElement => el?.type === 'frame');
}

export function childrenOf(ctx: BoardContext, frameId: string): Element[] {
	const out: Element[] = [];
	for (const el of ctx.store.elements.values()) if (el.parentId === frameId) out.push(el);
	return out;
}

/**
 * Recomputes frame membership after elements were created, moved or resized. `ids` are the
 * changed elements; changed frames also re-check everything that overlaps them now or overlapped
 * them before (`previous` holds frames' rects before the change). Writes only real changes, with
 * the LOCAL origin, so it joins the current gesture's undo step.
 */
export function syncFrameMembership(
	ctx: BoardContext,
	ids: Iterable<string>,
	previous: ReadonlyMap<string, Rect> = new Map()
): void {
	const all = frames(ctx);
	const candidates = new Set<string>();
	for (const id of ids) {
		const el = ctx.store.get(id);
		if (!el) continue;
		if (el.type !== 'frame') {
			candidates.add(id);
			continue;
		}
		for (const rect of [el, previous.get(id)]) {
			if (!rect) continue;
			for (const other of ctx.store.index.search(rect)) candidates.add(other);
		}
		for (const child of childrenOf(ctx, id)) candidates.add(child.id);
	}

	const patches: { id: string; patch: ElementPatch }[] = [];
	for (const id of candidates) {
		const el = ctx.store.get(id);
		if (!el || el.type === 'frame' || el.type === 'connector') continue;
		const box = ctx.store.index.get(id);
		if (!box) continue;
		const parentId = frameFor(box, all);
		if (parentId !== el.parentId) patches.push({ id, patch: { parentId } });
	}
	if (patches.length) updateElements(ctx.doc, patches, LOCAL);
}

/** Adds the children of any frames in `els` (unlocked ones, not already included). */
export function withFrameChildren(ctx: BoardContext, els: readonly Element[]): Element[] {
	const ids = new Set(els.map((e) => e.id));
	const out = [...els];
	for (const el of els) {
		if (el.type !== 'frame') continue;
		for (const child of childrenOf(ctx, el.id)) {
			if (!child.locked && !ids.has(child.id)) {
				ids.add(child.id);
				out.push(child);
			}
		}
	}
	return out;
}

/**
 * Deletes elements; deleting a frame also deletes its unlocked children, while locked children are
 * released (parentId cleared) rather than deleted. One transaction.
 */
export function deleteWithChildren(ctx: BoardContext, ids: readonly string[]): void {
	const doomed = new Set(ids);
	const released: string[] = [];
	for (const id of ids) {
		if (ctx.store.get(id)?.type !== 'frame') continue;
		for (const child of childrenOf(ctx, id)) {
			if (child.locked) released.push(child.id);
			else doomed.add(child.id);
		}
	}
	ctx.doc.transact(() => {
		if (released.length) {
			updateElements(
				ctx.doc,
				released.map((id) => ({ id, patch: { parentId: null } }))
			);
		}
		deleteElements(ctx.doc, [...doomed]);
	}, LOCAL);
}
