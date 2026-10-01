import { DEFAULT_SIZES, newElementBase } from '$lib/model/defaults';
import { newId } from '$lib/model/ids';
import { createElements, updateElement } from '$lib/model/ops';
import type { Point, Rect } from '$lib/model/types';
import type { BoardContext } from '../context';
import { syncFrameMembership } from '../frameMembership';
import { getDefaultStyle } from '../style/styleDefaults';
import { dragRect } from './dragRect';
import { undoGesture } from './gesture';
import { createRafWriter } from './rafBatch';
import { createSnapper, type Snapper } from './snapper';
import type { CanvasPointerEvent, Tool } from './types';

const DRAG_THRESHOLD_PX = 3;
const MIN_FRAME = 40;

export function nextFrameTitle(ctx: BoardContext): string {
	return `Frame ${ctx.store.frameOrder.length + 1}`;
}

function createFrame(ctx: BoardContext, rect: Rect): string {
	const id = newId();
	createElements(ctx.doc, [
		{
			...newElementBase('frame', id, { x: 0, y: 0 }, getDefaultStyle('frame')),
			...rect,
			type: 'frame',
			title: nextFrameTitle(ctx)
		}
	]);
	return id;
}

/** Drag to draw a frame (click for 800×600); elements fully inside become its children. */
export function createFrameTool(ctx: BoardContext): Tool {
	const gesture = undoGesture(ctx.undo);
	let start: { world: Point; screen: Point } | null = null;
	let id: string | null = null;
	let snapper: Snapper | null = null;
	const writer = createRafWriter<Rect>((rect) => {
		if (id) updateElement(ctx.doc, id, rect);
	});
	const rectFor = (e: CanvasPointerEvent) =>
		dragRect(start!.world, snapper ? snapper.point(e.world, e.mod) : e.world, {
			square: e.shift,
			fromCenter: e.alt,
			minSize: MIN_FRAME
		});

	function reset() {
		snapper?.clear();
		snapper = null;
		writer.cancel();
		gesture.end();
		start = null;
		id = null;
	}

	return {
		id: 'frame',
		cursor: 'crosshair',
		onPointerDown(e) {
			snapper = createSnapper(ctx);
			start = { world: snapper.point(e.world, e.mod), screen: e.screen };
			snapper.clear();
			id = null;
			gesture.begin();
		},
		onPointerMove(e) {
			if (!start || !e.dragging) return;
			if (!id) {
				const moved = Math.hypot(e.screen.x - start.screen.x, e.screen.y - start.screen.y);
				if (moved >= DRAG_THRESHOLD_PX) id = createFrame(ctx, rectFor(e));
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
				const { w, h } = DEFAULT_SIZES.frame;
				created = createFrame(ctx, { x: e.world.x - w / 2, y: e.world.y - h / 2, w, h });
			}
			syncFrameMembership(ctx, [created]);
			reset();
			ctx.selection.set([created]);
			ctx.tools.returnToSelect();
		},
		onCancel() {
			if (id) writer.flush();
			reset();
		}
	};
}
