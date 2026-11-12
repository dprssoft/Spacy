import type { Point, Rect } from '$lib/model/types';

/** A guide line in world coordinates: vertical (axis 'x') at x = at, or horizontal at y = at. */
export interface Guide {
	axis: 'x' | 'y';
	at: number;
	from: number;
	to: number;
}

export interface SnapResult {
	dx: number;
	dy: number;
	guides: Guide[];
}

const xLines = (r: Rect) => [r.x, r.x + r.w / 2, r.x + r.w];
const yLines = (r: Rect) => [r.y, r.y + r.h / 2, r.y + r.h];
const EPS = 0.5;

/** Smallest correction (within `threshold`) moving any of `mine` onto any of `theirs`. */
function bestOffset(mine: number[], theirs: number[], threshold: number): number | null {
	let best: number | null = null;
	for (const m of mine) {
		for (const t of theirs) {
			const d = t - m;
			if (Math.abs(d) <= threshold && (best === null || Math.abs(d) < Math.abs(best))) best = d;
		}
	}
	return best;
}

/** Guides through every candidate (and the subject) that shares a line with the snapped subject. */
export function guidesFor(subject: Rect, candidates: readonly Rect[], axis: 'x' | 'y'): Guide[] {
	const lines = axis === 'x' ? xLines : yLines;
	const span = (r: Rect): [number, number] => (axis === 'x' ? [r.y, r.y + r.h] : [r.x, r.x + r.w]);
	const out: Guide[] = [];
	for (const at of lines(subject)) {
		const hits = candidates.filter((c) => lines(c).some((l) => Math.abs(l - at) < EPS));
		if (hits.length === 0) continue;
		const all = [subject, ...hits].map(span);
		out.push({
			axis,
			at,
			from: Math.min(...all.map((s) => s[0])),
			to: Math.max(...all.map((s) => s[1]))
		});
	}
	return out;
}

/** Snaps a moving box to other boxes' edges and centers. Each axis snaps independently. */
export function snapMove(moving: Rect, candidates: readonly Rect[], threshold: number): SnapResult {
	const xs = candidates.flatMap(xLines);
	const ys = candidates.flatMap(yLines);
	const dx = bestOffset(xLines(moving), xs, threshold);
	const dy = bestOffset(yLines(moving), ys, threshold);
	const snapped = { ...moving, x: moving.x + (dx ?? 0), y: moving.y + (dy ?? 0) };
	return {
		dx: dx ?? 0,
		dy: dy ?? 0,
		guides: [
			...(dx !== null ? guidesFor(snapped, candidates, 'x') : []),
			...(dy !== null ? guidesFor(snapped, candidates, 'y') : [])
		]
	};
}

/** Snaps a point (a dragged corner/edge) to other boxes' edges and centers. */
export function snapPoint(
	p: Point,
	candidates: readonly Rect[],
	threshold: number
): { point: Point; guides: Guide[]; snappedX: boolean; snappedY: boolean } {
	const dx = bestOffset([p.x], candidates.flatMap(xLines), threshold);
	const dy = bestOffset([p.y], candidates.flatMap(yLines), threshold);
	const point = { x: p.x + (dx ?? 0), y: p.y + (dy ?? 0) };
	const dot = { x: point.x, y: point.y, w: 0, h: 0 };
	return {
		point,
		snappedX: dx !== null,
		snappedY: dy !== null,
		guides: [
			...(dx !== null ? guidesFor(dot, candidates, 'x').slice(0, 1) : []),
			...(dy !== null ? guidesFor(dot, candidates, 'y').slice(0, 1) : [])
		]
	};
}

export function snapToGrid(v: number, grid: number): number {
	return Math.round(v / grid) * grid;
}
