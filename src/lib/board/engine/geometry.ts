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
