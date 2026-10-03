import type { Rect } from '$lib/model/types';
import { unionRects } from './geometry';

export type AlignEdge = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

export interface Boxed {
	id: string;
	/** World AABB (rotation applied). */
	box: Rect;
}

export interface Shift {
	id: string;
	dx: number;
	dy: number;
}

/** Moves each item so its AABB lines up with the selection bounds' edge or center. */
export function align(items: readonly Boxed[], edge: AlignEdge): Shift[] {
	const b = unionRects(items.map((i) => i.box));
	if (!b || items.length < 2) return [];
	return items.map(({ id, box }) => {
		switch (edge) {
			case 'left':
				return { id, dx: b.x - box.x, dy: 0 };
			case 'hcenter':
				return { id, dx: b.x + b.w / 2 - (box.x + box.w / 2), dy: 0 };
			case 'right':
				return { id, dx: b.x + b.w - (box.x + box.w), dy: 0 };
			case 'top':
				return { id, dx: 0, dy: b.y - box.y };
			case 'vcenter':
				return { id, dx: 0, dy: b.y + b.h / 2 - (box.y + box.h / 2) };
			case 'bottom':
				return { id, dx: 0, dy: b.y + b.h - (box.y + box.h) };
		}
	});
}

/** Equal gaps between items along an axis; the two outermost items stay put. Needs 3+ items. */
export function distribute(items: readonly Boxed[], axis: 'h' | 'v'): Shift[] {
	if (items.length < 3) return [];
	const pos = (r: Rect) => (axis === 'h' ? r.x : r.y);
	const size = (r: Rect) => (axis === 'h' ? r.w : r.h);
	const sorted = [...items].sort((a, b) => pos(a.box) - pos(b.box));
	const first = sorted[0]!.box;
	const last = sorted[sorted.length - 1]!.box;
	const span = pos(last) + size(last) - pos(first);
	const used = sorted.reduce((sum, i) => sum + size(i.box), 0);
	const gap = (span - used) / (sorted.length - 1);
	let cursor = pos(first);
	return sorted.map(({ id, box }) => {
		const d = cursor - pos(box);
		cursor += size(box) + gap;
		return axis === 'h' ? { id, dx: d, dy: 0 } : { id, dx: 0, dy: d };
	});
}

/** New sizes making every item as wide and/or tall as the largest one. */
export function matchSize(
	items: readonly { id: string; w: number; h: number }[],
	dim: 'w' | 'h' | 'both'
): { id: string; w: number; h: number }[] {
	if (items.length < 2) return [];
	const maxW = Math.max(...items.map((i) => i.w));
	const maxH = Math.max(...items.map((i) => i.h));
	return items.map((i) => ({
		id: i.id,
		w: dim === 'h' ? i.w : maxW,
		h: dim === 'w' ? i.h : maxH
	}));
}

export const STACK_PADDING = 16;
export const STACK_GAP = 12;

/**
 * Stacks boxes in a column inside `frame`: in reading order (top, then left), left-aligned at the
 * frame's padding, `STACK_GAP` apart. Returns the shifts and the frame height that holds them all
 * (never less than the current height).
 */
export function stackInFrame(
	frame: Rect,
	items: readonly Boxed[]
): { shifts: Shift[]; frameH: number } {
	const sorted = [...items].sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
	let y = frame.y + STACK_PADDING;
	const shifts = sorted.map(({ id, box }) => {
		const shift = { id, dx: frame.x + STACK_PADDING - box.x, dy: y - box.y };
		y += box.h + STACK_GAP;
		return shift;
	});
	const needed = sorted.length ? y - STACK_GAP + STACK_PADDING - frame.y : 0;
	return { shifts, frameH: Math.max(frame.h, needed) };
}
