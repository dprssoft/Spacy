import type { Point, SketchElement } from '$lib/model/types';
import { strokeBounds, strokeHit, type SketchStroke } from './brushes';

// A sketch element shows the rectangle (bx, by, nw, nh) of its own coordinate space, stretched
// onto its box (x, y, w, h). These helpers convert between the two and grow the rectangle.

type Frame = Pick<SketchElement, 'x' | 'y' | 'w' | 'h' | 'bx' | 'by' | 'nw' | 'nh'>;

/** Board units per sketch unit, per axis (1 until the element is resized). */
export function sketchScale(el: Frame): Point {
	return { x: el.nw > 0 ? el.w / el.nw : 1, y: el.nh > 0 ? el.h / el.nh : 1 };
}

export function worldToSketch(el: Frame, p: Point): Point {
	const s = sketchScale(el);
	return { x: el.bx + (p.x - el.x) / s.x, y: el.by + (p.y - el.y) / s.y };
}

/** Stroke points (flat x, y, pressure) from board to sketch coordinates, rounded to 0.1. */
export function pointsToSketch(el: Frame, world: readonly number[]): number[] {
	const s = sketchScale(el);
	const r = (n: number) => Math.round(n * 10) / 10;
	return world.map((v, i) =>
		i % 3 === 0 ? r(el.bx + (v - el.x) / s.x) : i % 3 === 1 ? r(el.by + (v - el.y) / s.y) : v
	);
}

/**
 * The element's new frame after adding a stroke: the shown rectangle grows to include it, and the
 * box grows with it so that everything already drawn stays exactly where it is on the board.
 * Returns null when the stroke already fits.
 */
export function growFrame(el: Frame, stroke: SketchStroke): Frame | null {
	const b = strokeBounds(stroke);
	const x1 = Math.min(el.bx, b.x);
	const y1 = Math.min(el.by, b.y);
	const x2 = Math.max(el.bx + el.nw, b.x + b.w);
	const y2 = Math.max(el.by + el.nh, b.y + b.h);
	if (x1 === el.bx && y1 === el.by && x2 === el.bx + el.nw && y2 === el.by + el.nh) return null;
	const s = sketchScale(el);
	return {
		bx: x1,
		by: y1,
		nw: x2 - x1,
		nh: y2 - y1,
		x: el.x + (x1 - el.bx) * s.x,
		y: el.y + (y1 - el.by) * s.y,
		w: (x2 - x1) * s.x,
		h: (y2 - y1) * s.y
	};
}

/** The frame of a new sketch whose only stroke is `stroke` (sketch space = board space). */
export function firstFrame(stroke: SketchStroke): Frame {
	const b = strokeBounds(stroke);
	const w = Math.max(1, b.w);
	const h = Math.max(1, b.h);
	return { x: b.x, y: b.y, w, h, bx: b.x, by: b.y, nw: w, nh: h };
}

/** Whether a board point is on any stroke of the sketch (`tol` in board units). */
export function sketchHit(
	el: Frame,
	strokes: readonly SketchStroke[],
	p: Point,
	tol: number
): boolean {
	const s = sketchScale(el);
	const local = worldToSketch(el, p);
	const localTol = tol / Math.max(0.0001, Math.min(s.x, s.y));
	return strokes.some((st) => strokeHit(st, local, localTol));
}
