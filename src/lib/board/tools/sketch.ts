import type { BoardContext } from '../context';
import { NO_PRESSURE } from '../sketch/brushes';
import { commitStroke } from '../sketch/ops';
import { createRafWriter } from './rafBatch';
import type { CanvasPointerEvent, Tool } from './types';

/**
 * Sketching: every stroke goes into one sketch object (the active one, or a new one started by
 * the first stroke). Points are collected locally and previewed; the document is written once per
 * stroke, on release.
 */
export function createSketchTool(ctx: BoardContext): Tool {
	let points: number[] = [];
	let drawing = false;
	const brush = () => ({ id: ctx.sketch.brush, size: ctx.sketch.size, color: ctx.sketch.color });
	const preview = createRafWriter<number[]>((pts) => {
		const b = brush();
		ctx.preview.sketch = { b: b.id, c: b.color, s: b.size, p: pts };
	});

	// A stylus reports real pressure; mouse and touch get a placeholder (the pen brush then
	// simulates pressure from speed).
	const pressureOf = (e: PointerEvent | MouseEvent) =>
		e instanceof PointerEvent && e.pointerType === 'pen' && e.pressure > 0
			? Math.round(e.pressure * 100) / 100
			: NO_PRESSURE;

	function add(e: CanvasPointerEvent) {
		const native = e.native;
		const events =
			native instanceof PointerEvent && typeof native.getCoalescedEvents === 'function'
				? native.getCoalescedEvents()
				: [];
		if (events.length === 0) {
			points.push(e.world.x, e.world.y, pressureOf(native));
			return;
		}
		const z = ctx.viewport.zoom;
		for (const c of events)
			points.push(
				e.world.x + (c.clientX - native.clientX) / z,
				e.world.y + (c.clientY - native.clientY) / z,
				pressureOf(c)
			);
	}

	function reset() {
		preview.cancel();
		ctx.preview.sketch = null;
		points = [];
		drawing = false;
	}

	return {
		id: 'sketch',
		cursor: 'crosshair',
		onPointerDown(e) {
			drawing = true;
			points = [];
			add(e);
			preview.push(points.slice());
		},
		onPointerMove(e) {
			if (!drawing || !e.dragging) return;
			add(e);
			preview.push(points.slice());
		},
		onPointerUp(e) {
			if (!drawing) return;
			add(e);
			const active = ctx.sketch.activeId;
			const target = active && ctx.store.get(active)?.type === 'sketch' ? active : null;
			const id = commitStroke(ctx, target, brush(), points);
			if (id) ctx.sketch.activeId = id;
			reset();
		},
		onCancel: reset
	};
}
