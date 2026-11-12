import type { Rect } from '$lib/model/types';
import { guidesFor, snapMove, type Guide } from './snapping';

// Equal spacing: a moving box snaps so that its gap to a neighbour in the same row (or column)
// equals a gap already there, or so that it sits midway between two neighbours.

/**
 * A gap shown while dragging. Axis 'x': a horizontal gap from x = `from` to x = `to`, drawn at
 * y = `at`; axis 'y': a vertical one from y = `from` to y = `to`, at x = `at`.
 */
export interface GapMark {
	axis: 'x' | 'y';
	from: number;
	to: number;
	at: number;
}

export interface EqualSnapResult {
	dx: number;
	dy: number;
	guides: Guide[];
	gaps: GapMark[];
	/** Whether an axis snapped to anything (edges, centers or a gap). */
	snappedX: boolean;
	snappedY: boolean;
}

const EPS = 0.5;
/** Rows with more boxes than this keep the nearest ones: gap search is cubic in the row size. */
const MAX_ROW = 40;

// Everything below works along x; the y axis runs the same code on transposed boxes.
const flip = (r: Rect): Rect => ({ x: r.y, y: r.x, w: r.h, h: r.w });
const right = (r: Rect) => r.x + r.w;
const bottom = (r: Rect) => r.y + r.h;
const encloses = (o: Rect, i: Rect) =>
	o.x <= i.x && o.y <= i.y && right(o) >= right(i) && bottom(o) >= bottom(i);

/** Boxes overlapping `m` across the axis (same row), nearest first. */
function rowOf(m: Rect, candidates: readonly Rect[]): Rect[] {
	const cx = m.x + m.w / 2;
	return candidates
		.filter((c) => c.y < bottom(m) && bottom(c) > m.y && c !== m)
		.sort((a, b) => Math.abs(a.x + a.w / 2 - cx) - Math.abs(b.x + b.w / 2 - cx))
		.slice(0, MAX_ROW);
}

interface Gap {
	a: Rect;
	b: Rect;
	size: number;
}

/** Gaps between boxes of a row that have no other box of the row in between. */
function gapsIn(row: readonly Rect[]): Gap[] {
	const out: Gap[] = [];
	for (const a of row)
		for (const b of row) {
			const size = b.x - right(a);
			if (a === b || size <= EPS) continue;
			// Two boxes "in a row" must overlap across the axis themselves, not just with the mover.
			if (!(a.y < bottom(b) && b.y < bottom(a))) continue;
			// Something in between breaks the gap, but a box around both (a frame) doesn't.
			const blocked = row.some(
				(c) =>
					c !== a &&
					c !== b &&
					c.x < b.x &&
					right(c) > right(a) &&
					c.y < bottom(a) &&
					bottom(c) > a.y &&
					!encloses(c, a) &&
					!encloses(c, b)
			);
			if (!blocked) out.push({ a, b, size });
		}
	return out;
}

/** The smallest correction along x (within `threshold`) giving `m` an equal gap, or null. */
function gapOffset(m: Rect, candidates: readonly Rect[], threshold: number): number | null {
	const row = rowOf(m, candidates);
	const before = row.filter((c) => right(c) <= m.x + threshold);
	const after = row.filter((c) => c.x >= right(m) - threshold);
	const a = before.reduce<Rect | null>(
		(best, c) => (!best || right(c) > right(best) ? c : best),
		null
	);
	const b = after.reduce<Rect | null>((best, c) => (!best || c.x < best.x ? c : best), null);
	const targets: number[] = [];
	if (a && b && b.x - right(a) >= m.w) targets.push((right(a) + b.x - m.w) / 2);
	for (const { size } of gapsIn(row)) {
		if (a) targets.push(right(a) + size);
		if (b) targets.push(b.x - size - m.w);
	}
	let best: number | null = null;
	for (const t of targets) {
		const d = t - m.x;
		if (Math.abs(d) <= threshold && (best === null || Math.abs(d) < Math.abs(best))) best = d;
	}
	return best;
}

/** The gaps of `m`'s row that are as wide as a gap of `m` itself (none if `m` has no match). */
function equalGaps(m: Rect, candidates: readonly Rect[]): GapMark[] {
	const gaps = gapsIn([m, ...rowOf(m, candidates)]);
	const mine = gaps.filter((g) => g.a === m || g.b === m);
	for (const g of mine) {
		const same = gaps.filter((h) => Math.abs(h.size - g.size) < EPS);
		if (same.length < 2) continue;
		return same
			.sort((g, h) => g.a.x - h.a.x)
			.map(({ a, b }) => ({
				axis: 'x',
				from: right(a),
				to: b.x,
				at: (Math.max(a.y, b.y) + Math.min(bottom(a), bottom(b))) / 2
			}));
	}
	return [];
}

/**
 * Snaps a moving box to other boxes' edges and centers (`snapMove`) and to equal gaps, per axis:
 * whichever needs the smaller correction wins. Gap marks are shown for every gap of the result
 * that matches one of the moving box's gaps.
 */
export function snapMoveEqual(
	moving: Rect,
	candidates: readonly Rect[],
	threshold: number,
	/** The boxes equal gaps are measured between (default: all candidates). */
	gapCandidates: readonly Rect[] = candidates
): EqualSnapResult {
	const edges = snapMove(moving, candidates, threshold);
	const edgeX = edges.guides.some((g) => g.axis === 'x') ? edges.dx : null;
	const edgeY = edges.guides.some((g) => g.axis === 'y') ? edges.dy : null;
	const flipped = gapCandidates.map(flip);
	const gapX = gapOffset(moving, gapCandidates, threshold);
	const gapY = gapOffset(flip(moving), flipped, threshold);
	const pick = (edge: number | null, gap: number | null) =>
		gap !== null && (edge === null || Math.abs(gap) < Math.abs(edge) - EPS) ? gap : edge;
	const dx = pick(edgeX, gapX);
	const dy = pick(edgeY, gapY);
	const snapped = { ...moving, x: moving.x + (dx ?? 0), y: moving.y + (dy ?? 0) };
	const gaps = [
		...equalGaps(snapped, gapCandidates),
		...equalGaps(flip(snapped), flipped).map((g): GapMark => ({ ...g, axis: 'y' }))
	];
	return {
		dx: dx ?? 0,
		dy: dy ?? 0,
		guides: [
			...(dx !== null ? guidesFor(snapped, candidates, 'x') : []),
			...(dy !== null ? guidesFor(snapped, candidates, 'y') : [])
		],
		gaps,
		snappedX: dx !== null,
		snappedY: dy !== null
	};
}
