import type { FrameElement, Point, Rect } from '$lib/model/types';
import { pointInRotatedRect } from '../../engine/geometry';

/** Title label size in world units (it scales with the board like everything else). */
export const FRAME_TITLE_FONT = 14;
export const FRAME_TITLE_H = 22;

/** The frame box plus its title label (for culling and the spatial index). */
export function frameAABB(el: FrameElement): Rect {
	return { x: el.x, y: el.y - FRAME_TITLE_H, w: el.w, h: el.h + FRAME_TITLE_H };
}

export function titleRect(el: FrameElement) {
	const w = Math.max(48, el.title.length * FRAME_TITLE_FONT * 0.6 + 16);
	return { x: el.x, y: el.y - FRAME_TITLE_H, w: Math.min(w, Math.max(48, el.w)), h: FRAME_TITLE_H };
}

/**
 * Frames are hit on their border band or their title label only, so clicks inside an empty frame
 * reach the canvas (marquee) and the elements on it.
 */
export function frameHitTest(el: FrameElement, p: Point, tol: number): boolean {
	const band = Math.max(tol * 2, 1);
	const t = titleRect(el);
	if (p.x >= t.x && p.x <= t.x + t.w && p.y >= t.y && p.y <= t.y + t.h) return true;
	const outer = pointInRotatedRect(p, el, 0, band);
	const inner =
		el.w > band * 2 && el.h > band * 2
			? pointInRotatedRect(
					p,
					{ x: el.x + band, y: el.y + band, w: el.w - band * 2, h: el.h - band * 2 },
					0
				)
			: false;
	return outer && !inner;
}
