import type { Point, ShapeKind } from '$lib/model/types';

/**
 * SVG path for a shape of size w×h, inset by `inset` on every side (so strokes stay inside the
 * box). Flowchart kinds render as rectangles until step 22.
 */
export function shapePath(kind: ShapeKind, w: number, h: number, radius = 0, inset = 0): string {
	const x0 = inset;
	const y0 = inset;
	const x1 = Math.max(x0, w - inset);
	const y1 = Math.max(y0, h - inset);
	const cw = x1 - x0;
	const ch = y1 - y0;

	switch (kind) {
		case 'ellipse': {
			const rx = cw / 2;
			const ry = ch / 2;
			return `M ${x0} ${y0 + ry} A ${rx} ${ry} 0 1 0 ${x1} ${y0 + ry} A ${rx} ${ry} 0 1 0 ${x0} ${y0 + ry} Z`;
		}
		case 'diamond':
		case 'decision': {
			const cx = x0 + cw / 2;
			const cy = y0 + ch / 2;
			return `M ${cx} ${y0} L ${x1} ${cy} L ${cx} ${y1} L ${x0} ${cy} Z`;
		}
		default: {
			const r = Math.max(0, Math.min(radius, cw / 2, ch / 2));
			if (r === 0) return `M ${x0} ${y0} H ${x1} V ${y1} H ${x0} Z`;
			return [
				`M ${x0 + r} ${y0}`,
				`H ${x1 - r}`,
				`A ${r} ${r} 0 0 1 ${x1} ${y0 + r}`,
				`V ${y1 - r}`,
				`A ${r} ${r} 0 0 1 ${x1 - r} ${y1}`,
				`H ${x0 + r}`,
				`A ${r} ${r} 0 0 1 ${x0} ${y1 - r}`,
				`V ${y0 + r}`,
				`A ${r} ${r} 0 0 1 ${x0 + r} ${y0}`,
				'Z'
			].join(' ');
		}
	}
}

const ELLIPSE_SEGMENTS = 48;

/**
 * Outline polygon of a shape kind in local coordinates (relative to the box's top-left), used for
 * connector attachment. Corner rounding is ignored. Flowchart kinds are added in step 22.
 */
export function shapeOutline(kind: ShapeKind, w: number, h: number): Point[] {
	switch (kind) {
		case 'ellipse': {
			const pts: Point[] = [];
			for (let i = 0; i < ELLIPSE_SEGMENTS; i++) {
				const a = (i / ELLIPSE_SEGMENTS) * Math.PI * 2;
				pts.push({ x: w / 2 + (Math.cos(a) * w) / 2, y: h / 2 + (Math.sin(a) * h) / 2 });
			}
			return pts;
		}
		case 'diamond':
		case 'decision':
			return [
				{ x: w / 2, y: 0 },
				{ x: w, y: h / 2 },
				{ x: w / 2, y: h },
				{ x: 0, y: h / 2 }
			];
		default:
			return [
				{ x: 0, y: 0 },
				{ x: w, y: 0 },
				{ x: w, y: h },
				{ x: 0, y: h }
			];
	}
}
