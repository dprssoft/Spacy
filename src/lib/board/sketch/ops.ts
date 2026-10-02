import { newElementBase } from '$lib/model/defaults';
import { newId } from '$lib/model/ids';
import { addSketchStroke } from '$lib/model/ops';
import type { BoardContext } from '../context';
import { simplifyRDP } from '../engine/simplify';
import { syncFrameMembership } from '../frameMembership';
import { getDefaultStyle } from '../style/styleDefaults';
import type { BrushId, SketchStroke } from './brushes';
import { firstFrame, growFrame, pointsToSketch, sketchScale } from './geometry';

/**
 * Adds a stroke drawn on the board (flat x, y, pressure in board coordinates) to a sketch, or
 * starts a new sketch with it. One undo step. Returns the sketch's id (null if nothing was added).
 */
export function commitStroke(
	ctx: BoardContext,
	sketchId: string | null,
	brush: { id: BrushId; size: number; color: string },
	worldPoints: readonly number[]
): string | null {
	const points = simplifyRDP(worldPoints, 0.4 / ctx.viewport.zoom);
	if (points.length < 3) return null;
	const target = sketchId ? ctx.store.get(sketchId) : undefined;
	const round = (p: number[]) => p.map((v, i) => (i % 3 === 2 ? v : Math.round(v * 10) / 10));

	ctx.undo.stopCapturing();
	if (target?.type === 'sketch' && !target.locked) {
		const s = sketchScale(target);
		const stroke: SketchStroke = {
			b: brush.id,
			c: brush.color,
			// Keep the brush as wide on the board as it was drawn, even if the sketch was resized.
			s: brush.size / Math.max(0.0001, Math.min(s.x, s.y)),
			p: pointsToSketch(target, points)
		};
		// An eraser only removes: it never makes the sketch bigger.
		const frame = brush.id === 'eraser' ? null : growFrame(target, stroke);
		addSketchStroke(ctx.doc, { id: target.id, stroke, patch: frame ?? undefined });
		ctx.undo.stopCapturing();
		if (frame) syncFrameMembership(ctx, [target.id]);
		return target.id;
	}
	if (brush.id === 'eraser') return null; // nothing to erase yet

	const stroke: SketchStroke = { b: brush.id, c: brush.color, s: brush.size, p: round(points) };
	const id = newId();
	addSketchStroke(ctx.doc, {
		id,
		stroke,
		create: {
			...newElementBase('sketch', id, { x: 0, y: 0 }, getDefaultStyle('sketch')),
			type: 'sketch',
			...firstFrame(stroke)
		}
	});
	ctx.undo.stopCapturing();
	syncFrameMembership(ctx, [id]);
	return id;
}
