import { describe, expect, it } from 'vitest';
import type { Point, Rect, Routing } from '$lib/model/types';
import { markerShape, MARKERS } from '../markers';
import { nearestT, pointAt, route, type RouteInput } from './index';

const A: Rect = { x: 0, y: 0, w: 100, h: 100 };
const B: Rect = { x: 300, y: 0, w: 100, h: 100 };
const sideBySide: RouteInput = {
	start: { x: 100, y: 50 },
	end: { x: 300, y: 50 },
	startDir: { x: 1, y: 0 },
	endDir: { x: -1, y: 0 },
	startBox: A,
	endBox: B,
	waypoints: []
};
// From A's bottom to B's top, B lower right.
const diagonal: RouteInput = {
	start: { x: 50, y: 100 },
	end: { x: 450, y: 300 },
	startDir: { x: 0, y: 1 },
	endDir: { x: 0, y: -1 },
	startBox: A,
	endBox: { x: 400, y: 300, w: 100, h: 100 },
	waypoints: []
};

function crossesInterior(points: Point[], r: Rect): boolean {
	for (let i = 1; i < points.length; i++) {
		const a = points[i - 1]!;
		const b = points[i]!;
		for (let s = 0.05; s < 1; s += 0.05) {
			const x = a.x + (b.x - a.x) * s;
			const y = a.y + (b.y - a.y) * s;
			if (x > r.x + 1 && x < r.x + r.w - 1 && y > r.y + 1 && y < r.y + r.h - 1) return true;
		}
	}
	return false;
}

describe('route', () => {
	it.each<Routing>(['straight', 'elbow', 'curve'])(
		'%s starts and ends at the endpoints',
		(kind) => {
			for (const input of [sideBySide, diagonal]) {
				const r = route(kind, input);
				expect(r.points[0]).toEqual(input.start);
				const last = r.points[r.points.length - 1]!;
				expect(last.x).toBeCloseTo(input.end.x);
				expect(last.y).toBeCloseTo(input.end.y);
				expect(r.d.startsWith('M')).toBe(true);
			}
		}
	);

	it('elbow routes are orthogonal and stay out of both boxes', () => {
		for (const input of [sideBySide, diagonal]) {
			const r = route('elbow', input);
			for (let i = 1; i < r.points.length; i++) {
				const a = r.points[i - 1]!;
				const b = r.points[i]!;
				expect(Math.abs(a.x - b.x) < 1e-6 || Math.abs(a.y - b.y) < 1e-6).toBe(true);
			}
			expect(crossesInterior(r.points, input.startBox!)).toBe(false);
			expect(crossesInterior(r.points, input.endBox!)).toBe(false);
		}
	});

	it('elbow leaves along the port direction', () => {
		const r = route('elbow', diagonal);
		expect(r.points[1]!.x).toBe(diagonal.start.x);
		expect(r.points[1]!.y).toBeGreaterThan(diagonal.start.y);
	});

	it('elbow passes through manual bends', () => {
		const r = route('elbow', { ...sideBySide, waypoints: [{ x: 200, y: -80 }] });
		expect(r.points.some((p) => p.x === 200 && p.y === -80)).toBe(true);
	});

	it('a curve is at least as long as the straight line', () => {
		const straight = route('straight', diagonal).length;
		expect(route('curve', diagonal).length).toBeGreaterThanOrEqual(straight - 1e-6);
		expect(route('curve', { ...diagonal, waypoints: [{ x: 300, y: 50 }] }).d).toContain('C');
	});
});

describe('pointAt / nearestT', () => {
	const r = route('straight', { ...sideBySide, startBox: null, endBox: null });

	it('walks the path by length', () => {
		expect(pointAt(r, 0).p).toEqual({ x: 100, y: 50 });
		expect(pointAt(r, 1).p).toEqual({ x: 300, y: 50 });
		expect(pointAt(r, 0.5).p).toEqual({ x: 200, y: 50 });
		expect(pointAt(r, 0.5).angle).toBe(0);
	});

	it('inverts pointAt', () => {
		const elbowRoute = route('elbow', diagonal);
		for (const t of [0.1, 0.33, 0.5, 0.8]) {
			const { p } = pointAt(elbowRoute, t);
			const back = nearestT(elbowRoute, p);
			expect(back.t).toBeCloseTo(t, 2);
			expect(back.dist).toBeLessThan(1e-6);
		}
	});
});

describe('markers', () => {
	it('has a shape for every marker except none', () => {
		for (const m of MARKERS) {
			const shape = markerShape(m.value, 12);
			if (m.value === 'none') expect(shape).toBeNull();
			else expect(shape!.d.length).toBeGreaterThan(0);
		}
	});
});

describe('elbow bends from a dragged segment', () => {
	it('reproduces the moved polyline when its interior points are stored as waypoints', () => {
		const r = route('elbow', diagonal);
		const i = 1; // first inner segment
		const a = r.points[i]!;
		const b = r.points[i + 1]!;
		const horizontal = Math.abs(a.y - b.y) < 1e-6;
		const moved = r.points.map((p, k) =>
			k === i || k === i + 1 ? (horizontal ? { x: p.x, y: p.y + 40 } : { x: p.x + 40, y: p.y }) : p
		);
		const again = route('elbow', { ...diagonal, waypoints: moved.slice(1, -1) });
		for (const p of moved) {
			expect(
				again.points.some((q) => Math.abs(q.x - p.x) < 1e-6 && Math.abs(q.y - p.y) < 1e-6)
			).toBe(true);
		}
		for (let k = 1; k < again.points.length; k++) {
			const p = again.points[k - 1]!;
			const q = again.points[k]!;
			expect(Math.abs(p.x - q.x) < 1e-6 || Math.abs(p.y - q.y) < 1e-6).toBe(true);
		}
	});
});
