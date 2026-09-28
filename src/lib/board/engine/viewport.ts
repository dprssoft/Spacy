import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEPS } from '$lib/model/defaults';
import type { Point, Rect } from '$lib/model/types';

/** screen = world * zoom + (x, y), with screen coordinates relative to the canvas container. */
export type Viewport = { x: number; y: number; zoom: number };
export type Size = { w: number; h: number };

export function screenToWorld(vp: Viewport, p: Point): Point {
	return { x: (p.x - vp.x) / vp.zoom, y: (p.y - vp.y) / vp.zoom };
}

export function worldToScreen(vp: Viewport, p: Point): Point {
	return { x: p.x * vp.zoom + vp.x, y: p.y * vp.zoom + vp.y };
}

export function clampZoom(z: number): number {
	return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

/** Zooms to `newZoom` keeping the world point under `screenPoint` fixed on screen. */
export function zoomAt(vp: Viewport, screenPoint: Point, newZoom: number): Viewport {
	const zoom = clampZoom(newZoom);
	const world = screenToWorld(vp, screenPoint);
	return { x: screenPoint.x - world.x * zoom, y: screenPoint.y - world.y * zoom, zoom };
}

export function panBy(vp: Viewport, dx: number, dy: number): Viewport {
	return { x: vp.x + dx, y: vp.y + dy, zoom: vp.zoom };
}

export function visibleWorldRect(vp: Viewport, size: Size): Rect {
	const tl = screenToWorld(vp, { x: 0, y: 0 });
	return { x: tl.x, y: tl.y, w: size.w / vp.zoom, h: size.h / vp.zoom };
}

/** A viewport showing `rect` centered, with `padding` screen px, never zooming past `maxZoom`. */
export function fitRect(rect: Rect, size: Size, padding = 64, maxZoom = 1): Viewport {
	const availW = Math.max(1, size.w - padding * 2);
	const availH = Math.max(1, size.h - padding * 2);
	const fit = Math.min(availW / Math.max(rect.w, 1), availH / Math.max(rect.h, 1));
	const zoom = clampZoom(Math.min(maxZoom, fit));
	return {
		x: size.w / 2 - (rect.x + rect.w / 2) * zoom,
		y: size.h / 2 - (rect.y + rect.h / 2) * zoom,
		zoom
	};
}

/** Next preset zoom level in `dir`, or the current zoom if already at the end. */
export function nextZoomStep(zoom: number, dir: 1 | -1): number {
	const eps = 1e-6;
	if (dir > 0) return ZOOM_STEPS.find((s) => s > zoom + eps) ?? ZOOM_MAX;
	return [...ZOOM_STEPS].reverse().find((s) => s < zoom - eps) ?? ZOOM_MIN;
}

/** The world origin at the center of the screen at 100%. */
export function centeredOrigin(size: Size): Viewport {
	return { x: size.w / 2, y: size.h / 2, zoom: 1 };
}
