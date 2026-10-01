import { FONT_SIZE_PX, LINE_HEIGHT } from '$lib/model/defaults';
import type { ConnectorElement, Element, Point, Rect } from '$lib/model/types';
import { distToSegment, rotatedAABB } from '../engine/geometry';
import { resolveEndpoints, type DiagramWorld, type Resolved } from './endpoints';
import { markerSize } from './markers';
import { pointAt, route, type Route } from './routing';

export interface ConnectorGeometry extends Resolved {
	route: Route;
	/** Polyline approximation of the path (for hit testing, bounds, labels). */
	points: Point[];
	/** SVG path data. */
	d: string;
	/** Directions the ends point to (for markers): outward at the start, along the path at the end. */
	startAngle: number;
	endAngle: number;
	bounds: Rect;
	/** Label box (world), when the connector has a label. */
	label: Rect | null;
}

type Cached = { from: Element | undefined; to: Element | undefined; geo: ConnectorGeometry };
// Keyed by the connector snapshot; valid while its attached elements' snapshots are unchanged.
const cache = new WeakMap<ConnectorElement, Cached>();

const attachedId = (c: ConnectorElement, end: 'from' | 'to') => {
	const ep = c[end];
	return ep.kind === 'free' ? null : ep.elementId;
};

/** The connector's current path (geometry is derived from the elements it attaches to — D8). */
export function connectorGeometry(c: ConnectorElement, world: DiagramWorld): ConnectorGeometry {
	const fromId = attachedId(c, 'from');
	const toId = attachedId(c, 'to');
	const from = fromId ? world.get(fromId) : undefined;
	const to = toId ? world.get(toId) : undefined;
	const hit = cache.get(c);
	if (hit && hit.from === from && hit.to === to) return hit.geo;

	const r = resolveEndpoints(c, world);
	const rt = route(c.routing, {
		...r,
		startBox: from ? rotatedAABB(from, from.rotation) : null,
		endBox: to ? rotatedAABB(to, to.rotation) : null,
		waypoints: c.waypoints
	});
	const pts = rt.points;
	const angle = (a: Point, b: Point) => Math.atan2(b.y - a.y, b.x - a.x);
	const startAngle = pts.length > 1 ? angle(pts[1]!, pts[0]!) : 0;
	const endAngle = pts.length > 1 ? angle(pts[pts.length - 2]!, pts[pts.length - 1]!) : 0;
	const label = labelRect(c, rt);
	const pad = c.style.strokeWidth / 2 + markerSize(c.style.strokeWidth);
	const lineBounds = boundsOf(pts, pad);
	const geo: ConnectorGeometry = {
		...r,
		route: rt,
		points: pts,
		d: rt.d,
		startAngle,
		endAngle,
		bounds: label ? union(lineBounds, label) : lineBounds,
		label
	};
	cache.set(c, { from, to, geo });
	return geo;
}

/** Approximate label box (text is measured roughly; good enough for hit testing and bounds). */
export function labelRect(c: ConnectorElement, rt: Route): Rect | null {
	const text = c.label.text.trim();
	if (!text) return null;
	const size = FONT_SIZE_PX[c.style.font.size === 'm' ? 's' : c.style.font.size];
	const lines = text.split('\n');
	const w = Math.max(...lines.map((l) => l.length)) * size * 0.6 + 12;
	const h = lines.length * size * LINE_HEIGHT + 4;
	const { p } = pointAt(rt, c.label.t);
	return { x: p.x - w / 2, y: p.y - h / 2, w, h };
}

function union(a: Rect, b: Rect): Rect {
	const x = Math.min(a.x, b.x);
	const y = Math.min(a.y, b.y);
	return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

export function boundsOf(points: readonly Point[], pad: number): Rect {
	let x1 = Infinity;
	let y1 = Infinity;
	let x2 = -Infinity;
	let y2 = -Infinity;
	for (const p of points) {
		x1 = Math.min(x1, p.x);
		y1 = Math.min(y1, p.y);
		x2 = Math.max(x2, p.x);
		y2 = Math.max(y2, p.y);
	}
	return { x: x1 - pad, y: y1 - pad, w: x2 - x1 + pad * 2, h: y2 - y1 + pad * 2 };
}

export function distToPolyline(points: readonly Point[], p: Point): number {
	let best = Infinity;
	for (let i = 0; i + 1 < points.length; i++) {
		best = Math.min(best, distToSegment(p, points[i]!, points[i + 1]!));
	}
	return best;
}

export function inRect(r: Rect | null, p: Point): boolean {
	return !!r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}
