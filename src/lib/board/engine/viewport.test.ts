import { describe, expect, it } from 'vitest';
import {
	centeredOrigin,
	clampZoom,
	fitRect,
	nextZoomStep,
	panBy,
	screenToWorld,
	visibleWorldRect,
	worldToScreen,
	zoomAt,
	type Viewport
} from './viewport';

const vp: Viewport = { x: 120, y: -40, zoom: 1.5 };

describe('viewport math', () => {
	it('converts between screen and world both ways', () => {
		const p = { x: 37, y: -210 };
		const back = screenToWorld(vp, worldToScreen(vp, p));
		expect(back.x).toBeCloseTo(p.x);
		expect(back.y).toBeCloseTo(p.y);
		expect(worldToScreen({ x: 10, y: 20, zoom: 2 }, { x: 5, y: 5 })).toEqual({ x: 20, y: 30 });
	});

	it.each([0.1, 0.5, 2, 4])('zoomAt keeps the anchor fixed at zoom %s', (z) => {
		const anchor = { x: 300, y: 180 };
		const worldBefore = screenToWorld(vp, anchor);
		const next = zoomAt(vp, anchor, z);
		expect(next.zoom).toBe(z);
		const worldAfter = screenToWorld(next, anchor);
		expect(worldAfter.x).toBeCloseTo(worldBefore.x);
		expect(worldAfter.y).toBeCloseTo(worldBefore.y);
	});

	it('clamps zoom to 10%–400%', () => {
		expect(clampZoom(0.01)).toBe(0.1);
		expect(clampZoom(9)).toBe(4);
		expect(zoomAt(vp, { x: 0, y: 0 }, 100).zoom).toBe(4);
	});

	it('pans in screen pixels', () => {
		expect(panBy(vp, 10, -5)).toEqual({ x: 130, y: -45, zoom: 1.5 });
	});

	it('computes the visible world rect', () => {
		expect(visibleWorldRect({ x: 0, y: 0, zoom: 2 }, { w: 800, h: 600 })).toEqual({
			x: 0,
			y: 0,
			w: 400,
			h: 300
		});
		expect(visibleWorldRect({ x: 100, y: 50, zoom: 1 }, { w: 800, h: 600 })).toEqual({
			x: -100,
			y: -50,
			w: 800,
			h: 600
		});
	});

	it('fits a rect centered, respecting padding and max zoom', () => {
		const size = { w: 1000, h: 800 };
		const big = fitRect({ x: 0, y: 0, w: 1744, h: 672 }, size, 64);
		expect(big.zoom).toBeCloseTo((1000 - 128) / 1744);
		const center = screenToWorld(big, { x: 500, y: 400 });
		expect(center.x).toBeCloseTo(872);
		expect(center.y).toBeCloseTo(336);

		const tiny = fitRect({ x: 10, y: 10, w: 20, h: 20 }, size);
		expect(tiny.zoom).toBe(1);
		expect(fitRect({ x: 10, y: 10, w: 20, h: 20 }, size, 64, 3).zoom).toBe(3);
	});

	it('steps through preset zoom levels and stops at the ends', () => {
		expect(nextZoomStep(1, 1)).toBe(1.5);
		expect(nextZoomStep(1, -1)).toBe(0.75);
		expect(nextZoomStep(1.2, 1)).toBe(1.5);
		expect(nextZoomStep(1.2, -1)).toBe(1);
		expect(nextZoomStep(4, 1)).toBe(4);
		expect(nextZoomStep(0.1, -1)).toBe(0.1);
	});

	it('centers the world origin at 100%', () => {
		expect(centeredOrigin({ w: 800, h: 600 })).toEqual({ x: 400, y: 300, zoom: 1 });
	});
});
