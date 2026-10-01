import { newElementBase } from '$lib/model/defaults';
import { newId } from '$lib/model/ids';
import { createElements } from '$lib/model/ops';
import type { BoardContext } from '../context';
import { simplifyRDP } from '../engine/simplify';
import { getDefaultStyle } from '../style/styleDefaults';
import { createRafWriter } from './rafBatch';
import type { CanvasPointerEvent, Tool } from './types';

const MOUSE_PRESSURE = 0.5;

/**
 * Freehand drawing. Points are collected locally and previewed in the overlay; the document is
 * written once, on release (one undo step, no per-move Yjs traffic).
 */
export function createPenTool(ctx: BoardContext): Tool {
	let points: number[] = [];
	let drawing = false;
	const style = () => getDefaultStyle('stroke');
	const preview = createRafWriter<number[]>((pts) => {
		const s = style();
		ctx.preview.stroke = { points: pts, width: s.strokeWidth, color: s.stroke };
	});

	const pressureOf = (e: PointerEvent | MouseEvent) =>
		e instanceof PointerEvent && e.pointerType === 'pen' && e.pressure > 0
			? e.pressure
			: MOUSE_PRESSURE;

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
		// Coalesced events carry the high-frequency samples between frames.
		const z = ctx.viewport.zoom;
		for (const c of events) {
			points.push(
				e.world.x + (c.clientX - native.clientX) / z,
				e.world.y + (c.clientY - native.clientY) / z,
				pressureOf(c)
			);
		}
	}

	function reset() {
		preview.cancel();
		ctx.preview.stroke = null;
		points = [];
		drawing = false;
	}

	return {
		id: 'pen',
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
			const simplified = simplifyRDP(points, 0.5 / ctx.viewport.zoom);
			let minX = Infinity;
			let minY = Infinity;
			let maxX = -Infinity;
			let maxY = -Infinity;
			for (let i = 0; i < simplified.length; i += 3) {
				minX = Math.min(minX, simplified[i]!);
				minY = Math.min(minY, simplified[i + 1]!);
				maxX = Math.max(maxX, simplified[i]!);
				maxY = Math.max(maxY, simplified[i + 1]!);
			}
			const local = simplified.map((v, i) => (i % 3 === 0 ? v - minX : i % 3 === 1 ? v - minY : v));
			const id = newId();
			ctx.undo.stopCapturing();
			createElements(ctx.doc, [
				{
					...newElementBase('stroke', id, { x: 0, y: 0 }, style()),
					x: minX,
					y: minY,
					w: Math.max(1, maxX - minX),
					h: Math.max(1, maxY - minY),
					type: 'stroke',
					points: local
				}
			]);
			ctx.undo.stopCapturing();
			reset();
		},
		onCancel: reset
	};
}
