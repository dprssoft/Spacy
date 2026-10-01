import type { Point } from '$lib/model/types';

export interface Route {
	/** SVG path data. */
	d: string;
	/** Polyline approximation (exact for straight/elbow). */
	points: Point[];
	length: number;
}

export const fmt = (n: number) => (Math.round(n * 100) / 100).toString();

export function polylineD(points: readonly Point[]): string {
	return points.map((p, i) => `${i ? 'L' : 'M'}${fmt(p.x)},${fmt(p.y)}`).join(' ');
}

export function polylineLength(points: readonly Point[]): number {
	let len = 0;
	for (let i = 1; i < points.length; i++) {
		len += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
	}
	return len;
}

/** The point at fraction `t` (0..1) of the path's length, and the path's direction there. */
export function pointAt(route: Route, t: number): { p: Point; angle: number } {
	const pts = route.points;
	if (pts.length === 1 || route.length === 0) return { p: pts[0] ?? { x: 0, y: 0 }, angle: 0 };
	let remaining = Math.min(1, Math.max(0, t)) * route.length;
	for (let i = 1; i < pts.length; i++) {
		const a = pts[i - 1]!;
		const b = pts[i]!;
		const seg = Math.hypot(b.x - a.x, b.y - a.y);
		if (remaining <= seg || i === pts.length - 1) {
			const f = seg === 0 ? 0 : Math.min(1, remaining / seg);
			return {
				p: { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f },
				angle: Math.atan2(b.y - a.y, b.x - a.x)
			};
		}
		remaining -= seg;
	}
	return { p: pts[pts.length - 1]!, angle: 0 };
}

/** The fraction `t` of the path closest to `p`, and the distance. */
export function nearestT(route: Route, p: Point): { t: number; dist: number } {
	const pts = route.points;
	let best = { t: 0, dist: Infinity };
	let walked = 0;
	for (let i = 1; i < pts.length; i++) {
		const a = pts[i - 1]!;
		const b = pts[i]!;
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const len2 = dx * dx + dy * dy;
		const f =
			len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
		const q = { x: a.x + dx * f, y: a.y + dy * f };
		const dist = Math.hypot(p.x - q.x, p.y - q.y);
		const seg = Math.sqrt(len2);
		if (dist < best.dist) best = { t: route.length ? (walked + seg * f) / route.length : 0, dist };
		walked += seg;
	}
	return best;
}

/** Removes zero-length segments and merges collinear points (keeps the ends). */
export function simplifyPolyline(points: readonly Point[]): Point[] {
	const out: Point[] = [];
	for (const p of points) {
		const last = out[out.length - 1];
		if (last && Math.abs(last.x - p.x) < 0.01 && Math.abs(last.y - p.y) < 0.01) continue;
		if (out.length >= 2) {
			const a = out[out.length - 2]!;
			const b = out[out.length - 1]!;
			const cross = (b.x - a.x) * (p.y - b.y) - (b.y - a.y) * (p.x - b.x);
			const dot = (b.x - a.x) * (p.x - b.x) + (b.y - a.y) * (p.y - b.y);
			if (Math.abs(cross) < 0.01 && dot >= 0) {
				out[out.length - 1] = p;
				continue;
			}
		}
		out.push(p);
	}
	return out;
}
