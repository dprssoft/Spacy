import type { Point, ShapeKind } from '$lib/model/types';

const f = (n: number) => (Math.round(n * 100) / 100).toString();
const ELLIPSE_SEGMENTS = 48;

function roundedRect(x0: number, y0: number, x1: number, y1: number, radius: number): string {
	const r = Math.max(0, Math.min(radius, (x1 - x0) / 2, (y1 - y0) / 2));
	if (r === 0) return `M ${f(x0)} ${f(y0)} H ${f(x1)} V ${f(y1)} H ${f(x0)} Z`;
	return [
		`M ${f(x0 + r)} ${f(y0)}`,
		`H ${f(x1 - r)}`,
		`A ${f(r)} ${f(r)} 0 0 1 ${f(x1)} ${f(y0 + r)}`,
		`V ${f(y1 - r)}`,
		`A ${f(r)} ${f(r)} 0 0 1 ${f(x1 - r)} ${f(y1)}`,
		`H ${f(x0 + r)}`,
		`A ${f(r)} ${f(r)} 0 0 1 ${f(x0)} ${f(y1 - r)}`,
		`V ${f(y0 + r)}`,
		`A ${f(r)} ${f(r)} 0 0 1 ${f(x0 + r)} ${f(y0)}`,
		'Z'
	].join(' ');
}

const poly = (pts: Point[]) => `M ${pts.map((p) => `${f(p.x)} ${f(p.y)}`).join(' L ')} Z`;

/** Cloud bumps: points on an ellipse, joined by outward arcs. */
function cloudPoints(x0: number, y0: number, w: number, h: number): Point[] {
	const n = 9;
	return Array.from({ length: n }, (_, i) => {
		const a = (i / n) * Math.PI * 2 - Math.PI / 2;
		return { x: x0 + w / 2 + Math.cos(a) * w * 0.4, y: y0 + h / 2 + Math.sin(a) * h * 0.36 };
	});
}

/** Database cylinder: height of the top/bottom ellipses. */
const cylRy = (h: number) => Math.min(h * 0.15, 20);
/** Document: height of the wavy bottom band. */
const DOC_WAVE = 0.15;
/** Data (parallelogram): horizontal skew. */
const skewOf = (w: number) => w * 0.15;

/**
 * SVG path for a shape of size w×h, inset by `inset` on every side (so strokes stay inside the
 * box). `radius` rounds rectangle-like kinds.
 */
export function shapePath(kind: ShapeKind, w: number, h: number, radius = 0, inset = 0): string {
	const x0 = inset;
	const y0 = inset;
	const x1 = Math.max(x0, w - inset);
	const y1 = Math.max(y0, h - inset);
	const cw = x1 - x0;
	const ch = y1 - y0;
	const cx = x0 + cw / 2;
	const cy = y0 + ch / 2;

	switch (kind) {
		case 'ellipse': {
			const rx = cw / 2;
			const ry = ch / 2;
			return `M ${f(x0)} ${f(cy)} A ${f(rx)} ${f(ry)} 0 1 0 ${f(x1)} ${f(cy)} A ${f(rx)} ${f(ry)} 0 1 0 ${f(x0)} ${f(cy)} Z`;
		}
		case 'diamond':
		case 'decision':
			return poly([
				{ x: cx, y: y0 },
				{ x: x1, y: cy },
				{ x: cx, y: y1 },
				{ x: x0, y: cy }
			]);
		case 'terminator':
			return roundedRect(x0, y0, x1, y1, Math.min(ch, cw) / 2);
		case 'data': {
			const s = skewOf(cw);
			return poly([
				{ x: x0 + s, y: y0 },
				{ x: x1, y: y0 },
				{ x: x1 - s, y: y1 },
				{ x: x0, y: y1 }
			]);
		}
		case 'document': {
			const yb = y1 - ch * DOC_WAVE;
			return `M ${f(x0)} ${f(y0)} H ${f(x1)} V ${f(yb)} Q ${f(x0 + cw * 0.75)} ${f(yb - ch * DOC_WAVE)} ${f(cx)} ${f(yb)} T ${f(x0)} ${f(yb)} Z`;
		}
		case 'database': {
			const ry = cylRy(ch);
			const rx = cw / 2;
			return [
				`M ${f(x0)} ${f(y0 + ry)}`,
				`A ${f(rx)} ${f(ry)} 0 0 1 ${f(x1)} ${f(y0 + ry)}`,
				`V ${f(y1 - ry)}`,
				`A ${f(rx)} ${f(ry)} 0 0 1 ${f(x0)} ${f(y1 - ry)}`,
				'Z',
				// The visible front edge of the top lid.
				`M ${f(x0)} ${f(y0 + ry)} A ${f(rx)} ${f(ry)} 0 0 0 ${f(x1)} ${f(y0 + ry)}`
			].join(' ');
		}
		case 'cloud': {
			const pts = cloudPoints(x0, y0, cw, ch);
			const bump = Math.max(cw, ch) * 0.16;
			let d = `M ${f(pts[0]!.x)} ${f(pts[0]!.y)}`;
			for (let i = 0; i < pts.length; i++) {
				const b = pts[(i + 1) % pts.length]!;
				d += ` A ${f(bump)} ${f(bump)} 0 0 1 ${f(b.x)} ${f(b.y)}`;
			}
			return d + ' Z';
		}
		case 'actor': {
			const headR = Math.min(cw, ch) * 0.13;
			const headCy = y0 + headR + 1;
			const neck = headCy + headR;
			const hip = y0 + ch * 0.62;
			const arms = y0 + ch * 0.38;
			return [
				`M ${f(cx + headR)} ${f(headCy)} A ${f(headR)} ${f(headR)} 0 1 0 ${f(cx - headR)} ${f(headCy)} A ${f(headR)} ${f(headR)} 0 1 0 ${f(cx + headR)} ${f(headCy)} Z`,
				`M ${f(cx)} ${f(neck)} V ${f(hip)}`,
				`M ${f(x0 + cw * 0.18)} ${f(arms)} H ${f(x1 - cw * 0.18)}`,
				`M ${f(cx)} ${f(hip)} L ${f(x0 + cw * 0.22)} ${f(y1)}`,
				`M ${f(cx)} ${f(hip)} L ${f(x1 - cw * 0.22)} ${f(y1)}`
			].join(' ');
		}
		default:
			return roundedRect(x0, y0, x1, y1, radius);
	}
}

/** Whether a kind is drawn as line art (body lines unfilled), like the actor figure. */
export const isLineArt = (kind: ShapeKind) => kind === 'actor';

function ellipsePoints(
	cx: number,
	cy: number,
	rx: number,
	ry: number,
	n = ELLIPSE_SEGMENTS
): Point[] {
	return Array.from({ length: n }, (_, i) => {
		const a = (i / n) * Math.PI * 2;
		return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
	});
}

/**
 * Outline polygon of a shape kind in local coordinates (relative to the box's top-left), used for
 * connector attachment. Rounded corners and decorative details are approximated.
 */
export function shapeOutline(kind: ShapeKind, w: number, h: number): Point[] {
	switch (kind) {
		case 'ellipse':
		case 'cloud':
			return ellipsePoints(w / 2, h / 2, w / 2, h / 2);
		case 'diamond':
		case 'decision':
			return [
				{ x: w / 2, y: 0 },
				{ x: w, y: h / 2 },
				{ x: w / 2, y: h },
				{ x: 0, y: h / 2 }
			];
		case 'terminator': {
			const r = Math.min(w, h) / 2;
			const pts: Point[] = [];
			const arc = (cx: number, from: number) => {
				for (let i = 0; i <= 12; i++) {
					const a = from + (i / 12) * Math.PI;
					pts.push({ x: cx + Math.cos(a) * r, y: h / 2 + Math.sin(a) * r });
				}
			};
			arc(w - r, -Math.PI / 2);
			arc(r, Math.PI / 2);
			return pts;
		}
		case 'data': {
			const s = skewOf(w);
			return [
				{ x: s, y: 0 },
				{ x: w, y: 0 },
				{ x: w - s, y: h },
				{ x: 0, y: h }
			];
		}
		case 'document':
			// The wave is approximated by its average line.
			return [
				{ x: 0, y: 0 },
				{ x: w, y: 0 },
				{ x: w, y: h * (1 - DOC_WAVE) },
				{ x: 0, y: h * (1 - DOC_WAVE) }
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

export const SHAPE_KINDS: { kind: ShapeKind; label: string; group: 'Basic' | 'Flowchart' }[] = [
	{ kind: 'rect', label: 'Rectangle', group: 'Basic' },
	{ kind: 'ellipse', label: 'Ellipse', group: 'Basic' },
	{ kind: 'diamond', label: 'Diamond', group: 'Basic' },
	{ kind: 'process', label: 'Process', group: 'Flowchart' },
	{ kind: 'decision', label: 'Decision', group: 'Flowchart' },
	{ kind: 'terminator', label: 'Start / end', group: 'Flowchart' },
	{ kind: 'data', label: 'Data', group: 'Flowchart' },
	{ kind: 'document', label: 'Document', group: 'Flowchart' },
	{ kind: 'database', label: 'Database', group: 'Flowchart' },
	{ kind: 'cloud', label: 'Cloud', group: 'Flowchart' },
	{ kind: 'actor', label: 'Actor', group: 'Flowchart' }
];

/** Drag-and-drop data type for shapes dragged from the library onto the canvas. */
export const SHAPE_DRAG_TYPE = 'application/x-smthng-shape';
