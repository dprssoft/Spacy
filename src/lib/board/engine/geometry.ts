import type { Point, Rect } from '$lib/model/types';

export function expandRect(r: Rect, by: number): Rect {
	return { x: r.x - by, y: r.y - by, w: r.w + by * 2, h: r.h + by * 2 };
}

/** Grows a rect by a fraction of its own size on every side (0.5 = 50% of w/h each side). */
export function expandRectRatio(r: Rect, ratio: number): Rect {
	const dx = r.w * ratio;
	const dy = r.h * ratio;
	return { x: r.x - dx, y: r.y - dy, w: r.w + dx * 2, h: r.h + dy * 2 };
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
	return a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;
}

export function unionRects(rects: readonly Rect[]): Rect | null {
	if (rects.length === 0) return null;
	let x1 = Infinity;
	let y1 = Infinity;
	let x2 = -Infinity;
	let y2 = -Infinity;
	for (const r of rects) {
		x1 = Math.min(x1, r.x);
		y1 = Math.min(y1, r.y);
		x2 = Math.max(x2, r.x + r.w);
		y2 = Math.max(y2, r.y + r.h);
	}
	return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function rectCenter(r: Rect): Point {
	return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

export function rotatePoint(p: Point, center: Point, angle: number): Point {
	if (angle === 0) return { x: p.x, y: p.y };
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	const dx = p.x - center.x;
	const dy = p.y - center.y;
	return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
}

/** Corners (tl, tr, br, bl) of a rect rotated around its center. */
export function rectCorners(r: Rect, rotation: number): Point[] {
	const c = rectCenter(r);
	return [
		{ x: r.x, y: r.y },
		{ x: r.x + r.w, y: r.y },
		{ x: r.x + r.w, y: r.y + r.h },
		{ x: r.x, y: r.y + r.h }
	].map((p) => rotatePoint(p, c, rotation));
}

/** Axis-aligned bounds of a rect rotated around its center. */
export function rotatedAABB(r: Rect, rotation: number): Rect {
	if (rotation === 0) return { x: r.x, y: r.y, w: r.w, h: r.h };
	const pts = rectCorners(r, rotation);
	const xs = pts.map((p) => p.x);
	const ys = pts.map((p) => p.y);
	const x = Math.min(...xs);
	const y = Math.min(...ys);
	return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Whether `p` lies inside a rotated rect grown by `tol` on every side. */
export function pointInRotatedRect(p: Point, r: Rect, rotation: number, tol = 0): boolean {
	const local = rotatePoint(p, rectCenter(r), -rotation);
	return (
		local.x >= r.x - tol &&
		local.x <= r.x + r.w + tol &&
		local.y >= r.y - tol &&
		local.y <= r.y + r.h + tol
	);
}

export function distToSegment(p: Point, a: Point, b: Point): number {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const len2 = dx * dx + dy * dy;
	const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
	return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Even-odd point-in-polygon test. */
export function polygonContains(poly: readonly Point[], p: Point): boolean {
	let inside = false;
	for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
		const a = poly[i]!;
		const b = poly[j]!;
		if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
			inside = !inside;
		}
	}
	return inside;
}

/** Normalized rect spanning two corner points. */
export function rectFromPoints(a: Point, b: Point): Rect {
	return {
		x: Math.min(a.x, b.x),
		y: Math.min(a.y, b.y),
		w: Math.abs(b.x - a.x),
		h: Math.abs(b.y - a.y)
	};
}

/** Distance t ≥ 0 along the ray `origin + t·dir` where it crosses segment a–b, or null. */
export function raySegmentIntersection(
	origin: Point,
	dir: Point,
	a: Point,
	b: Point
): number | null {
	const ex = b.x - a.x;
	const ey = b.y - a.y;
	const denom = dir.x * ey - dir.y * ex;
	if (Math.abs(denom) < 1e-12) return null; // parallel
	const ax = a.x - origin.x;
	const ay = a.y - origin.y;
	const t = (ax * ey - ay * ex) / denom;
	const s = (ax * dir.y - ay * dir.x) / denom;
	if (t < 0 || s < -1e-9 || s > 1 + 1e-9) return null;
	return t;
}

/** Where a ray from `origin` (inside) finally leaves the polygon: its farthest crossing. */
export function rayPolygonExit(origin: Point, dir: Point, poly: readonly Point[]): Point | null {
	let best: number | null = null;
	for (let i = 0; i < poly.length; i++) {
		const t = raySegmentIntersection(origin, dir, poly[i]!, poly[(i + 1) % poly.length]!);
		if (t !== null && (best === null || t > best)) best = t;
	}
	return best === null ? null : { x: origin.x + dir.x * best, y: origin.y + dir.y * best };
}

/** The point on the polygon's boundary closest to `p`. */
export function nearestPointOnPolygon(poly: readonly Point[], p: Point): Point {
	let best = poly[0] ?? p;
	let bestD = Infinity;
	for (let i = 0; i < poly.length; i++) {
		const a = poly[i]!;
		const b = poly[(i + 1) % poly.length]!;
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const len2 = dx * dx + dy * dy;
		const t =
			len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
		const q = { x: a.x + t * dx, y: a.y + t * dy };
		const d = Math.hypot(q.x - p.x, q.y - p.y);
		if (d < bestD) {
			bestD = d;
			best = q;
		}
	}
	return best;
}
