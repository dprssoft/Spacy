// Brushes of the sketch tool. Pure: strokes in, SVG path data and paint settings out; the same
// result is drawn on the canvas (Path2D), in the live preview and in exported SVG.
import { getStroke } from 'perfect-freehand';
import type { Point, Rect } from '$lib/model/types';

export type BrushId = 'pen' | 'pencil' | 'marker' | 'highlighter' | 'eraser';

/** One brush stroke as stored: brush, color, size and flat [x, y, pressure, …] points. */
export interface SketchStroke {
	b: BrushId;
	c: string;
	s: number;
	p: number[];
}

export const BRUSHES: { id: BrushId; label: string; hint: string }[] = [
	{ id: 'pen', label: 'Pen', hint: 'Pressure changes the width' },
	{ id: 'pencil', label: 'Pencil', hint: 'Thin and light; pressure changes the width' },
	{ id: 'marker', label: 'Marker', hint: 'Even, solid line' },
	{ id: 'highlighter', label: 'Highlighter', hint: 'Wide and see-through' },
	{ id: 'eraser', label: 'Eraser', hint: 'Erases inside the sketch' }
];
const BRUSH_IDS = new Set<string>(BRUSHES.map((b) => b.id));

export const MIN_SIZE = 1;
export const MAX_SIZE = 48;
/** Input without real pressure (mouse, touch) is stored with this value. */
export const NO_PRESSURE = 0.5;

/** Validates stored stroke data (it comes from the document). */
export function parseStroke(v: unknown): SketchStroke | null {
	if (!v || typeof v !== 'object') return null;
	const { b, c, s, p } = v as Record<string, unknown>;
	if (typeof b !== 'string' || !BRUSH_IDS.has(b) || typeof c !== 'string') return null;
	if (typeof s !== 'number' || !Number.isFinite(s) || s <= 0) return null;
	if (!Array.isArray(p) || p.length < 3 || p.length % 3 !== 0) return null;
	if (!p.every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
	return { b: b as BrushId, c, s, p: p as number[] };
}

export interface StrokePaint {
	/** SVG path data in the stroke's own coordinates. */
	d: string;
	/** `fill`: `d` is an outline; `stroke`: `d` is a center line drawn `width` wide. */
	mode: 'fill' | 'stroke';
	width: number;
	opacity: number;
	cap: 'round';
	/** Removes what is under it instead of painting. */
	erase: boolean;
	color: string;
}

const f = (n: number) => (Math.round(n * 100) / 100).toString();
const avg = (a: number, b: number) => (a + b) / 2;

/** True when every sample has the placeholder pressure: let the outline simulate it from speed. */
function noRealPressure(p: readonly number[]): boolean {
	for (let i = 2; i < p.length; i += 3) if (p[i] !== NO_PRESSURE) return false;
	return true;
}

/** A filled outline whose width follows pressure (perfect-freehand). */
function outlineD(p: readonly number[], size: number, thinning: number): string {
	const input: number[][] = [];
	for (let i = 0; i + 2 < p.length; i += 3) input.push([p[i]!, p[i + 1]!, p[i + 2]!]);
	const pts = getStroke(input, {
		size,
		thinning,
		smoothing: 0.5,
		streamline: 0.4,
		simulatePressure: noRealPressure(p),
		last: true
	});
	if (pts.length < 4) {
		// A tap: a dot.
		const r = size / 2;
		const [x, y] = [p[0]!, p[1]!];
		return `M${f(x - r)},${f(y)} a${f(r)},${f(r)} 0 1,0 ${f(r * 2)},0 a${f(r)},${f(r)} 0 1,0 ${f(-r * 2)},0 Z`;
	}
	let a = pts[0]!;
	let b = pts[1]!;
	const c = pts[2]!;
	let d = `M${f(a[0]!)},${f(a[1]!)} Q${f(b[0]!)},${f(b[1]!)} ${f(avg(b[0]!, c[0]!))},${f(avg(b[1]!, c[1]!))} T`;
	for (let i = 2; i < pts.length - 1; i++) {
		a = pts[i]!;
		b = pts[i + 1]!;
		d += `${f(avg(a[0]!, b[0]!))},${f(avg(a[1]!, b[1]!))} `;
	}
	return `${d}Z`;
}

/** A smooth center line through the points (quadratic curves through the midpoints). */
function lineD(p: readonly number[]): string {
	const n = p.length / 3;
	const x = (i: number) => p[i * 3]!;
	const y = (i: number) => p[i * 3 + 1]!;
	if (n === 1) return `M${f(x(0))},${f(y(0))} l0.01,0`;
	let d = `M${f(x(0))},${f(y(0))}`;
	for (let i = 1; i < n - 1; i++)
		d += ` Q${f(x(i))},${f(y(i))} ${f(avg(x(i), x(i + 1)))},${f(avg(y(i), y(i + 1)))}`;
	return `${d} L${f(x(n - 1))},${f(y(n - 1))}`;
}

/** How wide a stroke paints at most (for bounds and hit testing). */
export function strokeWidth(s: Pick<SketchStroke, 'b' | 's'>): number {
	switch (s.b) {
		case 'pencil':
			return s.s * 0.6;
		case 'highlighter':
			return s.s * 2.5;
		case 'eraser':
			return s.s * 2;
		default:
			return s.s;
	}
}

const THINNING: Partial<Record<BrushId, number>> = { pen: 0.6, pencil: 0.75 };

/**
 * The furthest a stroke paints from its center line. Pressure-sensitive brushes get wider than
 * their nominal size under full pressure (radius = size × (0.5 + thinning / 2)).
 */
export function strokeReach(s: Pick<SketchStroke, 'b' | 's'>): number {
	const t = THINNING[s.b];
	return t === undefined ? strokeWidth(s) / 2 : strokeWidth(s) * (0.5 + t / 2);
}

export function strokePaint(s: SketchStroke): StrokePaint {
	const width = strokeWidth(s);
	const base = { width, color: s.c, cap: 'round' as const, erase: false, opacity: 1 };
	switch (s.b) {
		case 'pen':
			return { ...base, d: outlineD(s.p, width, THINNING.pen!), mode: 'fill' };
		case 'pencil':
			return { ...base, d: outlineD(s.p, width, THINNING.pencil!), mode: 'fill', opacity: 0.8 };
		case 'marker':
			return { ...base, d: lineD(s.p), mode: 'stroke' };
		case 'highlighter':
			return { ...base, d: lineD(s.p), mode: 'stroke', opacity: 0.35 };
		case 'eraser':
			return { ...base, d: lineD(s.p), mode: 'stroke', erase: true };
	}
}

/** Bounds of a stroke including the widest it can paint. */
export function strokeBounds(s: SketchStroke): Rect {
	let x1 = Infinity;
	let y1 = Infinity;
	let x2 = -Infinity;
	let y2 = -Infinity;
	for (let i = 0; i + 2 < s.p.length; i += 3) {
		x1 = Math.min(x1, s.p[i]!);
		y1 = Math.min(y1, s.p[i + 1]!);
		x2 = Math.max(x2, s.p[i]!);
		y2 = Math.max(y2, s.p[i + 1]!);
	}
	const r = strokeReach(s);
	return { x: x1 - r, y: y1 - r, w: x2 - x1 + r * 2, h: y2 - y1 + r * 2 };
}

/** Whether `pt` is on the stroke (within its width plus `tol`). Erasers are never hit. */
export function strokeHit(s: SketchStroke, pt: Point, tol: number): boolean {
	if (s.b === 'eraser') return false;
	const reach = strokeWidth(s) / 2 + tol;
	const b = strokeBounds(s);
	if (pt.x < b.x - tol || pt.y < b.y - tol || pt.x > b.x + b.w + tol || pt.y > b.y + b.h + tol)
		return false;
	const n = s.p.length / 3;
	if (n === 1) return Math.hypot(pt.x - s.p[0]!, pt.y - s.p[1]!) <= reach;
	for (let i = 0; i < n - 1; i++) {
		const ax = s.p[i * 3]!;
		const ay = s.p[i * 3 + 1]!;
		const bx = s.p[i * 3 + 3]!;
		const by = s.p[i * 3 + 4]!;
		const dx = bx - ax;
		const dy = by - ay;
		const len = dx * dx + dy * dy;
		const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((pt.x - ax) * dx + (pt.y - ay) * dy) / len));
		if (Math.hypot(pt.x - (ax + dx * t), pt.y - (ay + dy * t)) <= reach) return true;
	}
	return false;
}
