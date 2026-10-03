import { GRID_SIZE } from '$lib/model/defaults';
import type { Viewport } from '../engine/viewport';

// The dot grid is a CSS background of a tiny SVG image. A radial-gradient background is
// re-rasterized per tile on every pan, which held panning at ~21 fps at low zoom (tiles under
// 10 px); an image tile is rasterized once. Tile images come in powers of two, so zooming reuses
// a handful of cached images instead of decoding a new one per zoom step.

/** The SVG tile size (px) drawn for a grid gap: its dot (r = 1) then shows at 0.7–1.4 px. */
export function gridTileSize(gap: number): number {
	return 2 ** Math.min(7, Math.max(2, Math.round(Math.log2(Math.max(1, gap)))));
}

/** A CSS `url()` for a tile with one dot in its center, like `radial-gradient(color 1px, …)`. */
export function gridTileUrl(tile: number, color: string): string {
	const c = tile / 2;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tile}" height="${tile}"><circle cx="${c}" cy="${c}" r="1" fill="${color}"/></svg>`;
	return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Screen distance between grid dots: the snap grid, or every 4th line when that's too dense. */
export function gridGap(zoom: number): number {
	return GRID_SIZE * zoom < 8 ? GRID_SIZE * 4 * zoom : GRID_SIZE * zoom;
}

let tileCache: { key: string; canvas: HTMLCanvasElement } | null = null;

/**
 * The same grid painted on a canvas (the scene canvas, which covers the background when it's
 * shown). `c` is in device pixels.
 */
export function paintGrid(c: CanvasRenderingContext2D, vp: Viewport, dpr: number, color: string) {
	const gap = gridGap(vp.zoom) * dpr;
	const px = Math.max(4, Math.round(gap));
	const key = `${px}|${dpr}|${color}`;
	if (tileCache?.key !== key) {
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = px;
		const tc = canvas.getContext('2d');
		if (!tc) return;
		tc.fillStyle = color;
		tc.beginPath();
		tc.arc(px / 2, px / 2, dpr, 0, Math.PI * 2);
		tc.fill();
		tileCache = { key, canvas };
	}
	const pattern = c.createPattern(tileCache.canvas, 'repeat');
	if (!pattern) return;
	// The tile is whole pixels; scale it to the exact gap so the dots stay on the world grid.
	const k = gap / px;
	pattern.setTransform(new DOMMatrix([k, 0, 0, k, vp.x * dpr, vp.y * dpr]));
	c.setTransform(1, 0, 0, 1, 0, 0);
	c.fillStyle = pattern;
	c.fillRect(0, 0, c.canvas.width, c.canvas.height);
}
