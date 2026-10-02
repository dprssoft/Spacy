import type { ConnectorElement, Element, Endpoint, Point } from '$lib/model/types';
import { nearestPointOnPolygon, rectCenter } from '../engine/geometry';
import type { SketchStroke } from '../sketch/brushes';
import { PORTS, type Connectable } from './connectable';

/** What diagram geometry needs from the board: element lookup and how each element connects. */
export interface DiagramWorld {
	get(id: string): Element | undefined;
	connectable(el: Element): Connectable | null;
	/** Brush strokes of a sketch element (for hit testing and rendering), when available. */
	strokes?(sketchId: string): readonly SketchStroke[];
}

export interface Resolved {
	start: Point;
	end: Point;
	/** Outward direction at each end (null for free ends). */
	startDir: Point | null;
	endDir: Point | null;
}

const norm = (v: Point): Point | null => {
	const l = Math.hypot(v.x, v.y);
	return l < 1e-9 ? null : { x: v.x / l, y: v.y / l };
};

function attached(ep: Endpoint, world: DiagramWorld): { el: Element; c: Connectable } | null {
	if (ep.kind === 'free') return null;
	const el = world.get(ep.elementId);
	const c = el ? world.connectable(el) : null;
	return el && c ? { el, c } : null;
}

/** Outward normal of the outline edge nearest to `p` (for fixed anchors). */
function edgeNormal(el: Element, c: Connectable, p: Point): Point | null {
	const poly = c.outline(el);
	const q = nearestPointOnPolygon(poly, p);
	return norm({ x: q.x - rectCenter(el).x, y: q.y - rectCenter(el).y });
}

/** A point that doesn't depend on the other end (floating ends use their element's center). */
function reference(ep: Endpoint, world: DiagramWorld): Point {
	if (ep.kind === 'free') return { x: ep.x, y: ep.y };
	const a = attached(ep, world);
	if (!a) return { x: ep.lastX, y: ep.lastY };
	const { el, c } = a;
	if (ep.kind === 'port') return c.ports(el)[ep.port];
	if (ep.kind === 'fixed') return c.localToWorld(el, ep.u, ep.v);
	return rectCenter(el);
}

function resolveOne(
	ep: Endpoint,
	other: Point,
	world: DiagramWorld
): { p: Point; dir: Point | null } {
	if (ep.kind === 'free') return { p: { x: ep.x, y: ep.y }, dir: null };
	const a = attached(ep, world);
	// Element gone (e.g. deleted in another tab before conversion): last known position, free.
	if (!a) return { p: { x: ep.lastX, y: ep.lastY }, dir: null };
	const { el, c } = a;
	if (ep.kind === 'port') return { p: c.ports(el)[ep.port], dir: c.portNormal(el, ep.port) };
	if (ep.kind === 'fixed') {
		const p = c.localToWorld(el, ep.u, ep.v);
		return { p, dir: edgeNormal(el, c, p) };
	}
	const p = c.rayExit(el, other);
	const center = rectCenter(el);
	return { p, dir: norm({ x: p.x - center.x, y: p.y - center.y }) };
}

/** Where a connector's ends are right now (geometry is derived, never stored — D8). */
export function resolveEndpoints(
	conn: Pick<ConnectorElement, 'from' | 'to'>,
	world: DiagramWorld
): Resolved {
	const s = resolveOne(conn.from, reference(conn.to, world), world);
	const e = resolveOne(conn.to, reference(conn.from, world), world);
	return { start: s.p, end: e.p, startDir: s.dir, endDir: e.dir };
}

/**
 * An endpoint attaching to `el` at pointer `p`: the port within `portRadius`, else floating;
 * `fixed` pins the exact spot (u, v clamped to the box).
 */
export function makeEndpoint(
	el: Element,
	c: Connectable,
	p: Point,
	mode: 'auto' | 'fixed',
	portRadius: number
): Endpoint {
	if (mode === 'fixed') {
		const { u, v } = c.worldToLocal(el, p);
		const cu = Math.min(1, Math.max(0, u));
		const cv = Math.min(1, Math.max(0, v));
		const at = c.localToWorld(el, cu, cv);
		return { kind: 'fixed', elementId: el.id, u: cu, v: cv, lastX: at.x, lastY: at.y };
	}
	const ports = c.ports(el);
	let best: (typeof PORTS)[number] | null = null;
	let bestD = portRadius;
	for (const port of PORTS) {
		const d = Math.hypot(ports[port].x - p.x, ports[port].y - p.y);
		if (d <= bestD) {
			best = port;
			bestD = d;
		}
	}
	if (best) {
		const at = ports[best];
		return { kind: 'port', elementId: el.id, port: best, lastX: at.x, lastY: at.y };
	}
	const at = c.rayExit(el, p);
	return { kind: 'float', elementId: el.id, lastX: at.x, lastY: at.y };
}

export const freeEndpoint = (p: Point): Endpoint => ({ kind: 'free', x: p.x, y: p.y });

export function endpointElementId(ep: Endpoint): string | null {
	return ep.kind === 'free' ? null : ep.elementId;
}
