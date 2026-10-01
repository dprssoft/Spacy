import type { Point, Rect, StrokeElement } from '$lib/model/types';
import {
	distToSegment,
	expandRect,
	rectCenter,
	rotatePoint,
	rotatedAABB
} from '../../engine/geometry';
import { BRUSH_SIZE } from './strokePath';

/** Bounds including the brush thickness (the box itself is the centre-line's bounds). */
export function strokeAABB(el: StrokeElement): Rect {
	return expandRect(rotatedAABB(el, el.rotation), BRUSH_SIZE[el.style.strokeWidth] / 2);
}

/** Within `tol` of the stroke's centre line, accounting for brush thickness and rotation. */
export function strokeHitTest(el: StrokeElement, p: Point, tol: number): boolean {
	const local = rotatePoint(p, rectCenter(el), -el.rotation);
	const lx = local.x - el.x;
	const ly = local.y - el.y;
	const reach = tol + BRUSH_SIZE[el.style.strokeWidth] / 2;
	const pts = el.points;
	if (pts.length < 6) {
		return pts.length >= 2 && Math.hypot(lx - pts[0]!, ly - pts[1]!) <= reach;
	}
	const q = { x: lx, y: ly };
	for (let i = 0; i + 5 < pts.length; i += 3) {
		const a = { x: pts[i]!, y: pts[i + 1]! };
		const b = { x: pts[i + 3]!, y: pts[i + 4]! };
		if (distToSegment(q, a, b) <= reach) return true;
	}
	return false;
}
