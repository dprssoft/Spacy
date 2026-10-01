import type { Element, Point, Port } from '$lib/model/types';
import {
	nearestPointOnPolygon,
	rayPolygonExit,
	rectCenter,
	rectCorners,
	rotatePoint
} from '../engine/geometry';

/** How connectors attach to an element (00-architecture.md §9). All points are world coordinates. */
export interface Connectable<E extends Element = Element> {
	/** Closed outline polygon. */
	outline(el: E): Point[];
	ports(el: E): Record<Port, Point>;
	/** Unit vector pointing out of the element at a port. */
	portNormal(el: E, port: Port): Point;
	/** Where the ray from the element's center toward `toward` leaves the outline. */
	rayExit(el: E, toward: Point): Point;
	/** u, v ∈ [0,1] of the unrotated box → world. */
	localToWorld(el: E, u: number, v: number): Point;
	/** World → u, v (not clamped). */
	worldToLocal(el: E, p: Point): { u: number; v: number };
}

export const PORTS: readonly Port[] = ['n', 'e', 's', 'w'];
const AXIS: Record<Port, Point> = {
	n: { x: 0, y: -1 },
	e: { x: 1, y: 0 },
	s: { x: 0, y: 1 },
	w: { x: -1, y: 0 }
};

const rotateVec = (v: Point, angle: number): Point => rotatePoint(v, { x: 0, y: 0 }, angle);

function localToWorld(el: Element, u: number, v: number): Point {
	return rotatePoint({ x: el.x + u * el.w, y: el.y + v * el.h }, rectCenter(el), el.rotation);
}

function worldToLocal(el: Element, p: Point): { u: number; v: number } {
	const local = rotatePoint(p, rectCenter(el), -el.rotation);
	return {
		u: el.w > 0 ? (local.x - el.x) / el.w : 0.5,
		v: el.h > 0 ? (local.y - el.y) / el.h : 0.5
	};
}

/**
 * A connectable built from an outline polygon in local coordinates (relative to the box's top-left).
 * Ports sit where the box's axes cross the outline (a diamond's tips, an ellipse's extremes).
 */
export function polygonConnectable<E extends Element>(
	localOutline: (el: E) => Point[]
): Connectable<E> {
	const outline = (el: E) => {
		const c = rectCenter(el);
		return localOutline(el).map((p) =>
			rotatePoint({ x: el.x + p.x, y: el.y + p.y }, c, el.rotation)
		);
	};
	const exit = (el: E, dir: Point, poly = outline(el)) =>
		rayPolygonExit(rectCenter(el), dir, poly) ?? nearestPointOnPolygon(poly, rectCenter(el));
	const ports = (el: E) => {
		const poly = outline(el);
		const out = {} as Record<Port, Point>;
		for (const p of PORTS) out[p] = exit(el, rotateVec(AXIS[p], el.rotation), poly);
		return out;
	};
	return {
		outline,
		ports,
		portNormal: (el, port) => rotateVec(AXIS[port], el.rotation),
		rayExit(el, toward) {
			const c = rectCenter(el);
			const dx = toward.x - c.x;
			const dy = toward.y - c.y;
			const len = Math.hypot(dx, dy);
			if (len < 1e-9) return ports(el).e;
			return exit(el, { x: dx / len, y: dy / len });
		},
		localToWorld,
		worldToLocal
	};
}

/** Default: the element's (rotated) bounding box. Used by stickies, text, images, frames, doc cards, strokes. */
export const boxConnectable: Connectable = {
	...polygonConnectable((el) => [
		{ x: 0, y: 0 },
		{ x: el.w, y: 0 },
		{ x: el.w, y: el.h },
		{ x: 0, y: el.h }
	]),
	outline: (el) => rectCorners(el, el.rotation)
};
