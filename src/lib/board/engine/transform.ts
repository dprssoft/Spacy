import type { Element, ElementPatch, Point, Rect } from '$lib/model/types';
import { rectCenter, rotatePoint, unionRects } from './geometry';

/** A rect with a rotation (radians) around its center. */
export type Box = Rect & { rotation: number };

export const RESIZE_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
export type ResizeHandle = (typeof RESIZE_HANDLES)[number];

/** Which edges a handle moves: -1 = left/top, 1 = right/bottom, 0 = none. */
const DIRS: Record<ResizeHandle, { x: -1 | 0 | 1; y: -1 | 0 | 1 }> = {
	nw: { x: -1, y: -1 },
	n: { x: 0, y: -1 },
	ne: { x: 1, y: -1 },
	e: { x: 1, y: 0 },
	se: { x: 1, y: 1 },
	s: { x: 0, y: 1 },
	sw: { x: -1, y: 1 },
	w: { x: -1, y: 0 }
};

export function isResizeHandle(h: string): h is ResizeHandle {
	return (RESIZE_HANDLES as readonly string[]).includes(h);
}

/**
 * The box that frames `els`: a single element keeps its rotation; several get the union of their
 * axis-aligned bounds (rotation 0). `aabb` supplies each element's world bounds.
 */
export function selectionBox(els: readonly Element[], aabb: (el: Element) => Rect): Box | null {
	if (els.length === 0) return null;
	if (els.length === 1) {
		const el = els[0]!;
		return { x: el.x, y: el.y, w: el.w, h: el.h, rotation: el.rotation };
	}
	const u = unionRects(els.map(aabb));
	return u && { ...u, rotation: 0 };
}

export interface ResizeOptions {
	keepAspect: boolean;
	fromCenter: boolean;
	minSize: number;
	/** Per-axis limits that override `minSize` (doc cards: min 240×120, fixed height when collapsed). */
	limits?: SizeLimits;
}

export interface SizeLimits {
	minW: number;
	minH: number;
	maxH?: number;
}

/**
 * Resizes `start` by dragging `handle` to `pointer` (world). Works in the box's own (unrotated)
 * frame: the opposite edge/corner stays fixed in world space (or the center, with `fromCenter`).
 * Dragging past the opposite edge clamps to `minSize` instead of flipping.
 */
export function resizeBox(
	start: Box,
	handle: ResizeHandle,
	pointer: Point,
	opts: ResizeOptions
): Box {
	const c = rectCenter(start);
	const p = rotatePoint(pointer, c, -start.rotation);
	const d = DIRS[handle];
	const min = opts.minSize;
	const minW = opts.limits?.minW ?? min;
	const minH = opts.limits?.minH ?? min;
	const maxH = opts.limits?.maxH ?? Infinity;

	const extent = (
		dir: -1 | 0 | 1,
		pos: number,
		lo: number,
		size: number,
		center: number,
		lim: number
	) => {
		if (dir === 0) return size;
		if (opts.fromCenter) return Math.max(lim, (pos - center) * dir * 2);
		const anchor = dir === 1 ? lo : lo + size;
		return Math.max(lim, (pos - anchor) * dir);
	};
	let w = extent(d.x, p.x, start.x, start.w, c.x, minW);
	let h = Math.min(maxH, extent(d.y, p.y, start.y, start.h, c.y, minH));

	if (opts.keepAspect && start.w > 0 && start.h > 0) {
		const ratio = start.w / start.h;
		if (d.x !== 0 && d.y !== 0) {
			const s = Math.max(w / start.w, h / start.h);
			w = Math.max(minW, start.w * s);
			h = Math.min(maxH, Math.max(minH, start.h * s));
		} else if (d.x !== 0) {
			h = Math.min(maxH, Math.max(minH, w / ratio));
		} else {
			w = Math.max(minW, h * ratio);
		}
	}

	const place = (dir: -1 | 0 | 1, lo: number, size: number, center: number, next: number) => {
		if (dir === 0 || opts.fromCenter) return center - next / 2;
		return dir === 1 ? lo : lo + size - next;
	};
	const left = place(d.x, start.x, start.w, c.x, w);
	const top = place(d.y, start.y, start.h, c.y, h);

	// The new rect lives in the old box's frame; map its center to world and rebuild the box there.
	const world = rotatePoint({ x: left + w / 2, y: top + h / 2 }, c, start.rotation);
	return { x: world.x - w / 2, y: world.y - h / 2, w, h, rotation: start.rotation };
}

/** Extra fields an element needs when its size changes (strokes scale their points). */
export function sizePatch(el: Element, w: number, h: number): ElementPatch {
	const patch: ElementPatch = { w, h };
	if (el.type === 'stroke' && el.w > 0 && el.h > 0) {
		const sx = w / el.w;
		const sy = h / el.h;
		patch.points = el.points.map((v, i) => (i % 3 === 0 ? v * sx : i % 3 === 1 ? v * sy : v));
	}
	if (el.type === 'text' && el.autoWidth && w !== el.w) patch.autoWidth = false;
	return patch;
}

/** Maps elements proportionally from box `from` to box `to` (both axis-aligned). */
export function scaleElementsToBox(
	els: readonly Element[],
	from: Rect,
	to: Rect
): { id: string; patch: ElementPatch }[] {
	const sx = from.w > 0 ? to.w / from.w : 1;
	const sy = from.h > 0 ? to.h / from.h : 1;
	return els
		.filter((el) => el.type !== 'connector')
		.map((el) => {
			const c = rectCenter(el);
			const nc = { x: to.x + (c.x - from.x) * sx, y: to.y + (c.y - from.y) * sy };
			const w = el.w * sx;
			const h = el.h * sy;
			return {
				id: el.id,
				patch: { ...sizePatch(el, w, h), x: nc.x - w / 2, y: nc.y - h / 2 }
			};
		});
}

/** Normalizes an angle to (-π, π]. */
export function normalizeAngle(a: number): number {
	const t = a % (Math.PI * 2);
	if (t > Math.PI) return t - Math.PI * 2;
	if (t <= -Math.PI) return t + Math.PI * 2;
	return t;
}

/** Rotates elements' centers around `center` and adds `delta` to their own rotation. */
export function rotateElementsAround(
	els: readonly Element[],
	center: Point,
	delta: number
): { id: string; patch: ElementPatch }[] {
	return els
		.filter((el) => el.type !== 'connector')
		.map((el) => {
			const c = rotatePoint(rectCenter(el), center, delta);
			return {
				id: el.id,
				patch: {
					x: c.x - el.w / 2,
					y: c.y - el.h / 2,
					rotation: normalizeAngle(el.rotation + delta)
				}
			};
		});
}

/** Rounds an angle to the nearest multiple of `step` (default 15°). */
export function snapAngle(angle: number, step = Math.PI / 12): number {
	return normalizeAngle(Math.round(angle / step) * step);
}

export interface HandlePoint {
	id: ResizeHandle | 'rotate';
	x: number;
	y: number;
}

export const ROTATE_HANDLE_OFFSET = 24;

/** Screen positions of the handles of `box`. */
export function selectionHandles(
	box: Box,
	toScreen: (p: Point) => Point,
	opts: { resize: boolean; rotate: boolean }
): HandlePoint[] {
	const c = rectCenter(box);
	const worldAt = (fx: number, fy: number) =>
		rotatePoint({ x: box.x + fx * box.w, y: box.y + fy * box.h }, c, box.rotation);
	const out: HandlePoint[] = [];
	if (opts.resize) {
		for (const id of RESIZE_HANDLES) {
			const d = DIRS[id];
			out.push({ id, ...toScreen(worldAt((d.x + 1) / 2, (d.y + 1) / 2)) });
		}
	}
	if (opts.rotate) {
		const top = toScreen(worldAt(0.5, 0));
		out.push({
			id: 'rotate',
			x: top.x + Math.sin(box.rotation) * ROTATE_HANDLE_OFFSET,
			y: top.y - Math.cos(box.rotation) * ROTATE_HANDLE_OFFSET
		});
	}
	return out;
}

/** The handle within `radius` px of `p` (rotate handle first: it's the easiest to miss). */
export function hitHandle(
	handles: readonly HandlePoint[],
	p: Point,
	radius: number
): HandlePoint['id'] | null {
	const sorted = [...handles].sort((a, b) => (a.id === 'rotate' ? -1 : b.id === 'rotate' ? 1 : 0));
	for (const h of sorted) if (Math.hypot(h.x - p.x, h.y - p.y) <= radius) return h.id;
	return null;
}

const CURSORS = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'] as const;
const HANDLE_ANGLE: Record<ResizeHandle, number> = {
	e: 0,
	se: 45,
	s: 90,
	sw: 135,
	w: 180,
	nw: 225,
	n: 270,
	ne: 315
};

/** Resize cursor for a handle on a box rotated by `rotation` radians. */
export function cursorForHandle(handle: ResizeHandle, rotation: number): string {
	const deg = HANDLE_ANGLE[handle] + (rotation * 180) / Math.PI;
	const idx = Math.round((((deg % 180) + 180) % 180) / 45) % 4;
	return CURSORS[idx]!;
}
