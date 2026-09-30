import { updateElement } from '$lib/model/ops';
import type { Point, Rect } from '$lib/model/types';
import type { BoardContext } from '../context';
import { createShape, createShapeAt } from './create';
import { dragRect } from './dragRect';
import { undoGesture } from './gesture';
import { createRafWriter } from './rafBatch';
import type { CanvasPointerEvent, Tool } from './types';

const DRAG_THRESHOLD_PX = 3;

/** Drag to draw a shape (Shift: square/circle, Alt: from center); click for the default size. */
export function createShapeTool(ctx: BoardContext): Tool {
	const gesture = undoGesture(ctx.undo);
	let start: { world: Point; screen: Point } | null = null;
	let id: string | null = null;
	const writer = createRafWriter<Rect>((rect) => {
		if (id) updateElement(ctx.doc, id, rect);
	});

	const rectFor = (e: CanvasPointerEvent) =>
		dragRect(start!.world, e.world, { square: e.shift, fromCenter: e.alt });

	const finish = (created: string) => {
		ctx.selection.set([created]);
		ctx.tools.returnToSelect();
	};

	const reset = () => {
		writer.cancel();
		gesture.end();
		start = null;
		id = null;
	};

	return {
		id: 'shape',
		cursor: 'crosshair',
		onPointerDown(e) {
			start = { world: e.world, screen: e.screen };
			id = null;
			gesture.begin();
		},
		onPointerMove(e) {
			if (!start || !e.dragging) return;
			if (!id) {
				const moved = Math.hypot(e.screen.x - start.screen.x, e.screen.y - start.screen.y);
				if (moved < DRAG_THRESHOLD_PX) return;
				id = createShape(ctx, ctx.tools.shapeKind, rectFor(e));
				return;
			}
			writer.push(rectFor(e));
		},
		onPointerUp(e) {
			if (!start) return;
			let created = id;
			if (created) {
				writer.push(rectFor(e));
				writer.flush();
			} else {
				created = createShapeAt(ctx, ctx.tools.shapeKind, e.world);
			}
			reset();
			finish(created);
		},
		onCancel() {
			if (id) writer.flush();
			reset();
		}
	};
}
