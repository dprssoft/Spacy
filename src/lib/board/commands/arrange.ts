import { updateElements } from '$lib/model/ops';
import type { ElementPatch } from '$lib/model/types';
import type { BoardContext } from '../context';
import {
	align,
	distribute,
	matchSize,
	stackInFrame,
	type AlignEdge,
	type Shift
} from '../engine/align';
import { transformTargets } from '../selectionInfo';
import { childrenOf, syncFrameMembership } from '../frameMembership';
import { sizePatch } from '../engine/transform';

export type ArrangeOp =
	| { kind: 'align'; edge: AlignEdge }
	| { kind: 'distribute'; axis: 'h' | 'v' }
	| { kind: 'match'; dim: 'w' | 'h' | 'both' };

/** Aligns, distributes or matches the size of the selection (unlocked, non-connectors). One undo step. */
export function arrange(ctx: BoardContext, op: ArrangeOp): void {
	const targets = transformTargets(ctx);
	if (targets.length < 2) return;
	const patches: { id: string; patch: ElementPatch }[] = [];

	if (op.kind === 'match') {
		const sizes = matchSize(targets, op.dim);
		for (const s of sizes) {
			const el = targets.find((t) => t.id === s.id)!;
			if (s.w !== el.w || s.h !== el.h) patches.push({ id: s.id, patch: sizePatch(el, s.w, s.h) });
		}
	} else {
		const items = targets.flatMap((el) => {
			const box = ctx.store.index.get(el.id);
			return box ? [{ id: el.id, box }] : [];
		});
		const shifts: Shift[] =
			op.kind === 'align' ? align(items, op.edge) : distribute(items, op.axis);
		const moved = new Set(targets.map((t) => t.id));
		for (const { id, dx, dy } of shifts) {
			if (!dx && !dy) continue;
			const el = ctx.store.get(id)!;
			patches.push({ id, patch: { x: el.x + dx, y: el.y + dy } });
			// A frame keeps its contents when it moves.
			if (el.type !== 'frame') continue;
			for (const child of childrenOf(ctx, id)) {
				if (child.locked || moved.has(child.id)) continue;
				patches.push({ id: child.id, patch: { x: child.x + dx, y: child.y + dy } });
			}
		}
	}
	if (patches.length === 0) return;
	ctx.undo.stopCapturing();
	updateElements(ctx.doc, patches);
	syncFrameMembership(
		ctx,
		patches.map((p) => p.id)
	);
	ctx.undo.stopCapturing();
}

/** The selected frame, when exactly one frame is selected and it has something to stack. */
export function stackableFrame(ctx: BoardContext): string | null {
	const id = ctx.selection.single;
	const el = id ? ctx.store.get(id) : undefined;
	if (el?.type !== 'frame' || el.locked) return null;
	return childrenOf(ctx, el.id).some((c) => c.type !== 'connector' && !c.locked) ? el.id : null;
}

/**
 * Stacks a frame's contents in a column (reading order), growing the frame when they don't fit.
 * Runs only when asked: frames never re-arrange by themselves. One undo step.
 */
export function stackContents(ctx: BoardContext, frameId: string): void {
	const frame = ctx.store.get(frameId);
	if (frame?.type !== 'frame') return;
	const items = childrenOf(ctx, frameId).flatMap((el) => {
		const box = el.type !== 'connector' && !el.locked ? ctx.store.index.get(el.id) : undefined;
		return box ? [{ id: el.id, box }] : [];
	});
	const { shifts, frameH } = stackInFrame(frame, items);
	const patches: { id: string; patch: ElementPatch }[] = [];
	if (frameH !== frame.h) patches.push({ id: frameId, patch: { h: frameH } });
	for (const { id, dx, dy } of shifts) {
		if (!dx && !dy) continue;
		const el = ctx.store.get(id)!;
		patches.push({ id, patch: { x: el.x + dx, y: el.y + dy } });
	}
	if (patches.length === 0) return;
	ctx.undo.stopCapturing();
	updateElements(ctx.doc, patches);
	syncFrameMembership(
		ctx,
		patches.map((p) => p.id)
	);
	ctx.undo.stopCapturing();
}
