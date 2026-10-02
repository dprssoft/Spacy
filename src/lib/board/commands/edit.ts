import * as Y from 'yjs';
import { cloneElements } from '$lib/model/clone';
import { getDocsMap } from '$lib/model/doc';
import { newId } from '$lib/model/ids';
import { createElements, setSketchStrokes, updateElements } from '$lib/model/ops';
import { rawStrokes } from '../sketch/data';
import { LOCAL } from '$lib/model/origins';
import type { Element, NewElement, Point } from '$lib/model/types';
import { compareZ } from '$lib/model/zorder';
import type { BoardContext } from '../context';
import { deleteWithChildren, syncFrameMembership, withFrameChildren } from '../frameMembership';
import { reorder, type ReorderOp } from './reorder';

// Board editing commands. Each is one undo step.

export function selectedElements(ctx: BoardContext): Element[] {
	return [...ctx.selection.ids]
		.map((id) => ctx.store.get(id))
		.filter((el): el is Element => !!el)
		.sort((a, b) => compareZ(a.z, b.z));
}

export function deleteSelection(ctx: BoardContext): void {
	const ids = selectedElements(ctx)
		.filter((el) => !el.locked)
		.map((el) => el.id);
	if (ids.length === 0) return;
	ctx.undo.stopCapturing();
	deleteWithChildren(ctx, ids);
	ctx.selection.clear();
}

/**
 * Creates `els` (cloned elements, z assigned above everything) plus copies of their doc card
 * contents, in one transaction. `fragments` maps new doc card ids to the content to copy.
 */
export function createWithContent(
	ctx: BoardContext,
	els: NewElement[],
	fragments: Map<string, Y.XmlFragment> = new Map(),
	/** New sketch ids → the strokes to copy into them. */
	sketches: Map<string, readonly unknown[]> = new Map()
): Element[] {
	let created: Element[] = [];
	ctx.doc.transact(() => {
		created = createElements(ctx.doc, els);
		const docs = getDocsMap(ctx.doc);
		for (const [id, frag] of fragments) docs.set(id, frag.clone());
		for (const [id, strokes] of sketches) setSketchStrokes(ctx.doc, id, strokes);
	}, LOCAL);
	// After the transaction: the store only sees the new elements once it has committed.
	syncFrameMembership(
		ctx,
		created.map((e) => e.id)
	);
	return created;
}

/** Copies the selection with an offset; the copies become the selection. */
export function duplicateSelection(ctx: BoardContext, offset: Point = { x: 16, y: 16 }): void {
	// A frame is copied with its contents.
	const els = withFrameChildren(ctx, selectedElements(ctx));
	if (els.length === 0) return;
	const { elements, idMap } = cloneElements(els, { offset });
	const docs = getDocsMap(ctx.doc);
	const fragments = new Map<string, Y.XmlFragment>();
	for (const [oldId, newIdValue] of idMap) {
		const frag = docs.get(oldId);
		if (frag) fragments.set(newIdValue, frag);
	}
	const sketches = new Map<string, readonly unknown[]>();
	for (const el of els) {
		const copy = el.type === 'sketch' ? idMap.get(el.id) : undefined;
		if (copy) sketches.set(copy, rawStrokes(ctx.doc, el.id));
	}
	ctx.undo.stopCapturing();
	const created = createWithContent(ctx, elements, fragments, sketches);
	ctx.undo.stopCapturing();
	ctx.selection.set(created.map((e) => e.id));
}

/** Changes stacking order. Frames only reorder among frames (they render in their own layer). */
export function reorderSelection(ctx: BoardContext, op: ReorderOp): void {
	const selected = new Set(ctx.selection.ids);
	const patches: { id: string; patch: { z: string } }[] = [];
	for (const isFrame of [true, false]) {
		const layer = [...ctx.store.elements.values()]
			.filter((el) => (el.type === 'frame') === isFrame)
			.map((el) => ({ id: el.id, z: el.z, rect: ctx.store.index.get(el.id) ?? el }));
		for (const [id, z] of reorder(layer, selected, op)) patches.push({ id, patch: { z } });
	}
	if (patches.length === 0) return;
	ctx.undo.stopCapturing();
	updateElements(ctx.doc, patches);
}

/** Locks everything if anything selected is unlocked; otherwise unlocks everything. */
export function toggleLock(ctx: BoardContext): void {
	const els = selectedElements(ctx);
	if (els.length === 0) return;
	const locked = els.some((el) => !el.locked);
	ctx.undo.stopCapturing();
	updateElements(
		ctx.doc,
		els.map((el) => ({ id: el.id, patch: { locked } }))
	);
}

export function groupSelection(ctx: BoardContext): void {
	const els = selectedElements(ctx);
	if (els.length < 2) return;
	const groupId = newId();
	ctx.undo.stopCapturing();
	updateElements(
		ctx.doc,
		els.map((el) => ({ id: el.id, patch: { groupId } }))
	);
	ctx.selection.enteredGroup = null;
}

export function ungroupSelection(ctx: BoardContext): void {
	const els = selectedElements(ctx).filter((el) => el.groupId !== null);
	if (els.length === 0) return;
	ctx.undo.stopCapturing();
	updateElements(
		ctx.doc,
		els.map((el) => ({ id: el.id, patch: { groupId: null } }))
	);
	ctx.selection.enteredGroup = null;
}

export const canGroup = (ctx: BoardContext) => ctx.selection.size >= 2;
export const canUngroup = (ctx: BoardContext) =>
	selectedElements(ctx).some((el) => el.groupId !== null);
