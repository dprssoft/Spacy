import type { Point, Rect, Routing } from '$lib/model/types';
import { CONNECTOR_STUB } from '$lib/model/defaults';
import { fmt, polylineD, polylineLength, simplifyPolyline, type Route } from './measure';

export { nearestT, pointAt, type Route } from './measure';

export interface RouteInput {
	start: Point;
	end: Point;
	/** Outward unit vectors at the ends (null for free ends). */
	startDir: Point | null;
	endDir: Point | null;
	/** Bounds of the attached elements (elbow routes avoid them). */
	startBox: Rect | null;
	endBox: Rect | null;
	/** Manual bends; [] = automatic. */
	waypoints: readonly Point[];
}

export function route(kind: Routing, input: RouteInput): Route {
	if (kind === 'curve') return curve(input);
	if (kind === 'elbow') return elbow(input);
	const points = simplifyPolyline([input.start, ...input.waypoints, input.end]);
	return { points, d: polylineD(points), length: polylineLength(points) };
}

// --- curve -----------------------------------------------------------------------------------

const SAMPLES = 24;

function bezierPoint(p0: Point, c1: Point, c2: Point, p1: Point, t: number): Point {
	const u = 1 - t;
	return {
		x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x,
		y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y
	};
}

function curve({ start, end, startDir, endDir, waypoints }: RouteInput): Route {
	const segs: [Point, Point, Point, Point][] = [];
	if (waypoints.length === 0) {
		const dist = Math.hypot(end.x - start.x, end.y - start.y);
		const k = Math.min(200, Math.max(40, dist * 0.4));
		const toward = (from: Point, to: Point): Point => {
			const l = Math.hypot(to.x - from.x, to.y - from.y) || 1;
			return { x: (to.x - from.x) / l, y: (to.y - from.y) / l };
		};
		const sd = startDir ?? toward(start, end);
		const ed = endDir ?? toward(end, start);
		segs.push([
			start,
			{ x: start.x + sd.x * k, y: start.y + sd.y * k },
			{ x: end.x + ed.x * k, y: end.y + ed.y * k },
			end
		]);
	} else {
		// Catmull-Rom through all points, as cubic Béziers.
		const pts = [start, ...waypoints, end];
		for (let i = 0; i + 1 < pts.length; i++) {
			const p0 = pts[i - 1] ?? pts[i]!;
			const p1 = pts[i]!;
			const p2 = pts[i + 1]!;
			const p3 = pts[i + 2] ?? p2;
			segs.push([
				p1,
				{ x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
				{ x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
				p2
			]);
		}
	}
	const points: Point[] = [start];
	for (const [p0, c1, c2, p1] of segs) {
		for (let s = 1; s <= SAMPLES; s++) points.push(bezierPoint(p0, c1, c2, p1, s / SAMPLES));
	}
	const d =
		`M${fmt(start.x)},${fmt(start.y)} ` +
		segs
			.map(
				([, c1, c2, p1]) =>
					`C${fmt(c1.x)},${fmt(c1.y)} ${fmt(c2.x)},${fmt(c2.y)} ${fmt(p1.x)},${fmt(p1.y)}`
			)
			.join(' ');
	return { points, d, length: polylineLength(points) };
}

// --- elbow -----------------------------------------------------------------------------------

/** The dominant axis of a direction (or of `fallback` when there is none), as a unit vector. */
function axisOf(dir: Point | null, fallback: Point): Point {
	const v = dir ?? fallback;
	return Math.abs(v.x) >= Math.abs(v.y)
		? { x: Math.sign(v.x) || 1, y: 0 }
		: { x: 0, y: Math.sign(v.y) || 1 };
}

/** Whether an axis-aligned segment passes through a rect's interior. */
function crosses(a: Point, b: Point, r: Rect | null): boolean {
	if (!r) return false;
	const inset = 1;
	const x1 = r.x + inset;
	const x2 = r.x + r.w - inset;
	const y1 = r.y + inset;
	const y2 = r.y + r.h - inset;
	if (a.y === b.y) {
		return a.y > y1 && a.y < y2 && Math.max(a.x, b.x) > x1 && Math.min(a.x, b.x) < x2;
	}
	return a.x > x1 && a.x < x2 && Math.max(a.y, b.y) > y1 && Math.min(a.y, b.y) < y2;
}

function cost(path: Point[], input: RouteInput, sd: Point, ed: Point): number {
	let c = polylineLength(path);
	for (let i = 1; i < path.length; i++) {
		const a = path[i - 1]!;
		const b = path[i]!;
		// The stubs start on the boxes' edges; only the middle must stay out of them.
		if (i > 1 && crosses(a, b, input.startBox)) c += 1000;
		if (i < path.length - 1 && crosses(a, b, input.endBox)) c += 1000;
	}
	// Turning straight back into the element after leaving it looks wrong.
	const first = path[2];
	if (first) {
		const v = { x: first.x - path[1]!.x, y: first.y - path[1]!.y };
		if (v.x * sd.x + v.y * sd.y < -0.01) c += 500;
	}
	const last = path[path.length - 3];
	if (last) {
		const v = { x: last.x - path[path.length - 2]!.x, y: last.y - path[path.length - 2]!.y };
		if (v.x * ed.x + v.y * ed.y < -0.01) c += 500;
	}
	return c + (path.length - 2) * 20;
}

function elbow(input: RouteInput): Route {
	const { start, end, waypoints } = input;
	const delta = { x: end.x - start.x, y: end.y - start.y };
	const sd = axisOf(input.startDir, delta);
	const ed = axisOf(input.endDir, { x: -delta.x, y: -delta.y });
	const s1 = { x: start.x + sd.x * CONNECTOR_STUB, y: start.y + sd.y * CONNECTOR_STUB };
	const e1 = { x: end.x + ed.x * CONNECTOR_STUB, y: end.y + ed.y * CONNECTOR_STUB };

	let middle: Point[];
	if (waypoints.length) {
		// Pass through each bend point, alternating axes.
		middle = [s1];
		let prev = s1;
		let horizontal = sd.x !== 0;
		for (const w of [...waypoints, e1]) {
			const corner = horizontal ? { x: w.x, y: prev.y } : { x: prev.x, y: w.y };
			middle.push(corner, w);
			prev = w;
			horizontal = !horizontal;
		}
	} else {
		const mx = (s1.x + e1.x) / 2;
		const my = (s1.y + e1.y) / 2;
		const candidates: Point[][] = [
			[s1, { x: e1.x, y: s1.y }, e1],
			[s1, { x: s1.x, y: e1.y }, e1],
			[s1, { x: mx, y: s1.y }, { x: mx, y: e1.y }, e1],
			[s1, { x: s1.x, y: my }, { x: e1.x, y: my }, e1]
		];
		middle = candidates
			.map((c) => ({ c, score: cost([start, ...c, end], input, sd, ed) }))
			.sort((a, b) => a.score - b.score)[0]!.c;
	}
	const points = simplifyPolyline([start, ...middle, end]);
	return { points, d: polylineD(points), length: polylineLength(points) };
}
