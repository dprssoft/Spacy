import { describe, expect, it } from 'vitest';
import {
	distToSegment,
	expandRect,
	expandRectRatio,
	nearestPointOnPolygon,
	pointInRotatedRect,
	polygonContains,
	rectCenter,
	rectCorners,
	rectFromPoints,
	rayPolygonExit,
	raySegmentIntersection,
	rectsIntersect,
	rotatedAABB,
	rotatePoint,
	unionRects
} from './geometry';

describe('rect helpers', () => {
	it('expands by a fixed amount or a ratio', () => {
		expect(expandRect({ x: 0, y: 0, w: 10, h: 10 }, 5)).toEqual({ x: -5, y: -5, w: 20, h: 20 });
		expect(expandRectRatio({ x: 0, y: 0, w: 100, h: 50 }, 0.5)).toEqual({
			x: -50,
			y: -25,
			w: 200,
			h: 100
		});
	});

	it('detects intersection, including touching edges', () => {
		const a = { x: 0, y: 0, w: 10, h: 10 };
		expect(rectsIntersect(a, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
		expect(rectsIntersect(a, { x: 10, y: 0, w: 5, h: 5 })).toBe(true);
		expect(rectsIntersect(a, { x: 11, y: 0, w: 5, h: 5 })).toBe(false);
		expect(rectsIntersect(a, { x: 0, y: -6, w: 5, h: 5 })).toBe(false);
	});

	it('unions rects', () => {
		expect(unionRects([])).toBeNull();
		expect(
			unionRects([
				{ x: 0, y: 0, w: 10, h: 10 },
				{ x: -5, y: 20, w: 5, h: 5 }
			])
		).toEqual({ x: -5, y: 0, w: 15, h: 25 });
	});

	it('finds the center', () => {
		expect(rectCenter({ x: 10, y: 20, w: 30, h: 40 })).toEqual({ x: 25, y: 40 });
	});
});

describe('rotation and hit helpers', () => {
	const r = { x: 0, y: 0, w: 100, h: 50 };

	it('rotates points around a center', () => {
		const p = rotatePoint({ x: 10, y: 0 }, { x: 0, y: 0 }, Math.PI / 2);
		expect(p.x).toBeCloseTo(0);
		expect(p.y).toBeCloseTo(10);
	});

	it('computes rotated AABBs at 0, 45 and 90 degrees', () => {
		expect(rotatedAABB(r, 0)).toEqual(r);
		const r90 = rotatedAABB(r, Math.PI / 2);
		expect(r90.w).toBeCloseTo(50);
		expect(r90.h).toBeCloseTo(100);
		expect(r90.x).toBeCloseTo(25);
		expect(r90.y).toBeCloseTo(-25);
		const r45 = rotatedAABB(r, Math.PI / 4);
		expect(r45.w).toBeCloseTo((150 * Math.SQRT2) / 2);
		expect(rectCorners(r, 0)).toEqual([
			{ x: 0, y: 0 },
			{ x: 100, y: 0 },
			{ x: 100, y: 50 },
			{ x: 0, y: 50 }
		]);
	});

	it('hit-tests rotated rects with tolerance', () => {
		expect(pointInRotatedRect({ x: 90, y: 25 }, r, 0)).toBe(true);
		// After a 90° rotation the long axis is vertical: (90, 25) falls outside, (50, -20) inside.
		expect(pointInRotatedRect({ x: 90, y: 25 }, r, Math.PI / 2)).toBe(false);
		expect(pointInRotatedRect({ x: 50, y: -20 }, r, Math.PI / 2)).toBe(true);
		expect(pointInRotatedRect({ x: 104, y: 25 }, r, 0)).toBe(false);
		expect(pointInRotatedRect({ x: 104, y: 25 }, r, 0, 5)).toBe(true);
	});

	it('measures distance to a segment', () => {
		expect(distToSegment({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5);
		expect(distToSegment({ x: -3, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5);
		expect(distToSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(5);
	});

	it('tests points in polygons', () => {
		const tri = [
			{ x: 0, y: 0 },
			{ x: 10, y: 0 },
			{ x: 0, y: 10 }
		];
		expect(polygonContains(tri, { x: 2, y: 2 })).toBe(true);
		expect(polygonContains(tri, { x: 8, y: 8 })).toBe(false);
	});

	it('builds a normalized rect from two points', () => {
		expect(rectFromPoints({ x: 10, y: 5 }, { x: 2, y: 9 })).toEqual({ x: 2, y: 5, w: 8, h: 4 });
	});
});

describe('ray and polygon helpers', () => {
	const square = [
		{ x: 0, y: 0 },
		{ x: 10, y: 0 },
		{ x: 10, y: 10 },
		{ x: 0, y: 10 }
	];

	it('intersects a ray with a segment', () => {
		expect(
			raySegmentIntersection({ x: 0, y: 5 }, { x: 1, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 })
		).toBe(10);
		expect(
			raySegmentIntersection({ x: 0, y: 5 }, { x: -1, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 })
		).toBeNull();
		expect(
			raySegmentIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 })
		).toBeNull();
	});

	it('finds where a ray leaves a polygon', () => {
		expect(rayPolygonExit({ x: 5, y: 5 }, { x: 0, y: -1 }, square)).toEqual({ x: 5, y: 0 });
		const d = Math.SQRT1_2;
		const p = rayPolygonExit({ x: 5, y: 5 }, { x: d, y: d }, square)!;
		expect(p.x).toBeCloseTo(10);
		expect(p.y).toBeCloseTo(10);
	});

	it('finds the nearest boundary point', () => {
		expect(nearestPointOnPolygon(square, { x: 5, y: 3 })).toEqual({ x: 5, y: 0 });
		expect(nearestPointOnPolygon(square, { x: 15, y: 15 })).toEqual({ x: 10, y: 10 });
	});
});
