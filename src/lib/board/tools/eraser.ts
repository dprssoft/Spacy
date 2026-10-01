import type { Point } from '$lib/model/types';
import type { BoardContext } from '../context';
import { deleteWithChildren } from '../frameMembership';
import { hitElement } from '../engine/hitTest';
import { screenToWorld } from '../engine/viewport';
import type { Tool } from './types';

const SAMPLE_PX = 4;
const TOLERANCE_PX = 4;
const TRAIL_LENGTH = 10;

/** Drag across elements to mark them; they're deleted on release (one undo step). */
export function createEraserTool(ctx: BoardContext): Tool {
	let last: Point | null = null;

	function mark(screen: Point) {
		const world = screenToWorld(ctx.viewport.vp, screen);
		const id = hitElement(ctx.store, world, TOLERANCE_PX / ctx.viewport.zoom);
		const el = id ? ctx.store.get(id) : undefined;
		if (el && !el.locked) ctx.preview.erasing.add(el.id);
	}

	/** Samples the segment from the last position so fast swipes don't skip elements. */
	function sweep(to: Point) {
		const from = last ?? to;
		const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / SAMPLE_PX));
		for (let i = 1; i <= steps; i++) {
			mark({
				x: from.x + ((to.x - from.x) * i) / steps,
				y: from.y + ((to.y - from.y) * i) / steps
			});
		}
		last = to;
		ctx.preview.eraserTrail = [...ctx.preview.eraserTrail, to].slice(-TRAIL_LENGTH);
	}

	function reset() {
		ctx.preview.erasing.clear();
		ctx.preview.eraserTrail = [];
		last = null;
	}

	return {
		id: 'eraser',
		cursor: 'cell',
		onPointerDown(e) {
			reset();
			last = e.screen;
			mark(e.screen);
			ctx.preview.eraserTrail = [e.screen];
		},
		onPointerMove(e) {
			if (e.dragging && last) sweep(e.screen);
		},
		onPointerUp() {
			const ids = [...ctx.preview.erasing];
			if (ids.length > 0) {
				ctx.undo.stopCapturing();
				deleteWithChildren(ctx, ids);
				ctx.undo.stopCapturing();
				for (const id of ids) ctx.selection.ids.delete(id);
			}
			reset();
		},
		onCancel: reset
	};
}
