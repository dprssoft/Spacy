import { getStroke } from 'perfect-freehand';
import type { StrokeWidth } from '$lib/model/types';

/** Brush diameter per stroke width setting. */
export const BRUSH_SIZE: Record<StrokeWidth, number> = { 1: 3, 2: 5, 4: 9, 8: 16 };

/** Mouse input has no pressure (we store 0.5): let perfect-freehand simulate it from speed. */
export function shouldSimulatePressure(points: readonly number[]): boolean {
	for (let i = 2; i < points.length; i += 3) if (points[i] !== 0.5) return false;
	return true;
}

/** Outline polygon of a stroke through flat [x, y, pressure, …] points. */
export function strokeOutline(
	points: readonly number[],
	size: number,
	simulatePressure: boolean
): number[][] {
	const input: number[][] = [];
	for (let i = 0; i + 2 < points.length; i += 3)
		input.push([points[i]!, points[i + 1]!, points[i + 2]!]);
	return getStroke(input, {
		size,
		thinning: 0.5,
		smoothing: 0.5,
		streamline: 0.5,
		simulatePressure,
		last: true
	});
}

const avg = (a: number, b: number) => (a + b) / 2;
const f = (n: number) => n.toFixed(2);

/** SVG path for an outline polygon (quadratic midpoint smoothing, from the perfect-freehand docs). */
export function outlineToSvgPath(outline: readonly number[][]): string {
	const len = outline.length;
	if (len < 4) return '';
	let a = outline[0]!;
	let b = outline[1]!;
	const c = outline[2]!;
	let d = `M${f(a[0]!)},${f(a[1]!)} Q${f(b[0]!)},${f(b[1]!)} ${f(avg(b[0]!, c[0]!))},${f(avg(b[1]!, c[1]!))} T`;
	for (let i = 2; i < len - 1; i++) {
		a = outline[i]!;
		b = outline[i + 1]!;
		d += `${f(avg(a[0]!, b[0]!))},${f(avg(a[1]!, b[1]!))} `;
	}
	return d + 'Z';
}

/** Path for a stroke; very short strokes (a click) become a dot. */
export function strokeSvgPath(points: readonly number[], width: StrokeWidth, scale = 1): string {
	const size = BRUSH_SIZE[width] * scale;
	const scaled = scale === 1 ? points : points.map((v, i) => (i % 3 === 2 ? v : v * scale));
	const d = outlineToSvgPath(strokeOutline(scaled, size, shouldSimulatePressure(points)));
	if (d || points.length < 2) return d;
	const r = size / 2;
	const x = scaled[0]!;
	const y = scaled[1]!;
	return `M${f(x - r)},${f(y)} a${f(r)},${f(r)} 0 1,0 ${f(r * 2)},0 a${f(r)},${f(r)} 0 1,0 ${f(-r * 2)},0 Z`;
}

/**
 * A memoized `strokeSvgPath` for one stroke view: moving a stroke gives it a new snapshot (and a
 * new `points` array) with the same values, so compare contents before recomputing the outline.
 */
export function strokePathMemo(): (points: readonly number[], width: StrokeWidth) => string {
	let last: { points: readonly number[]; width: StrokeWidth; d: string } | null = null;
	return (points, width) => {
		if (last && last.width === width && sameNumbers(last.points, points)) return last.d;
		const d = strokeSvgPath(points, width);
		last = { points, width, d };
		return d;
	};
}

export function sameNumbers(a: readonly number[], b: readonly number[]): boolean {
	if (a === b) return true;
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
	return true;
}
