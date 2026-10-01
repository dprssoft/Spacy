import type { ConnectorElement, Point, Rect } from '$lib/model/types';
import { distToSegment } from '../engine/geometry';
import { resolveEndpoints, type DiagramWorld, type Resolved } from './endpoints';

export interface ConnectorGeometry extends Resolved {
	/** Polyline approximation of the path (for hit testing, bounds, labels). */
	points: Point[];
	/** SVG path data. */
	d: string;
	bounds: Rect;
}

/** The connector's current path. Straight for now; routing arrives in step 21. */
export function connectorGeometry(c: ConnectorElement, world: DiagramWorld): ConnectorGeometry {
	const r = resolveEndpoints(c, world);
	const points = [r.start, ...c.waypoints, r.end];
	const d = points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
	return { ...r, points, d, bounds: boundsOf(points, c.style.strokeWidth / 2 + 8) };
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
