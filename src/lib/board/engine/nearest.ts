import type { Point, Rect } from '$lib/model/types';

/** Distance from `p` to `r` (0 inside). */
export function distToRect(p: Point, r: Rect): number {
	const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w));
	const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h));
	return Math.hypot(dx, dy);
}

/**
 * The candidate closest to `p` (by its bounds, then its centre), skipping any whose centre is
 * within `skipWithin` of `p` — the one already centred on screen — so pressing again moves on.
 */
export function nearestRect<T extends { rect: Rect }>(
	candidates: Iterable<T>,
	p: Point,
	skipWithin = 0
): T | null {
	let best: T | null = null;
	let bestD = Infinity;
	let bestC = Infinity;
	for (const c of candidates) {
		const r = c.rect;
		const centre = Math.hypot(r.x + r.w / 2 - p.x, r.y + r.h / 2 - p.y);
		if (centre <= skipWithin) continue;
		const d = distToRect(p, r);
		if (d < bestD || (d === bestD && centre < bestC)) {
			best = c;
			bestD = d;
			bestC = centre;
		}
	}
	return best;
}
