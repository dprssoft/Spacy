import type { Element, Point, Rect } from '$lib/model/types';
import type { BoardStore } from '../boardStore.svelte';
import { definitionOf } from '../elements';
import { rectsIntersect } from './geometry';

/** Paint order: frames beneath everything, then by z. Higher = on top. */
function above(a: Element, b: Element): boolean {
	const fa = a.type === 'frame' ? 0 : 1;
	const fb = b.type === 'frame' ? 0 : 1;
	return fa !== fb ? fa > fb : a.z > b.z;
}

/** Topmost element at world point `p` (tolerance in world units), or null. */
export function hitElement(store: BoardStore, p: Point, tol: number): string | null {
	let best: Element | null = null;
	for (const id of store.index.near(p, tol)) {
		const el = store.get(id);
		if (!el || !definitionOf(el).hitTest(el, p, tol)) continue;
		if (!best || above(el, best)) best = el;
	}
	return best?.id ?? null;
}

/**
 * Elements touched by (`intersect`) or fully inside (`contain`) a world rect.
 * Uses AABBs — precise enough for marquee selection.
 */
export function hitElementsInRect(
	store: BoardStore,
	rect: Rect,
	mode: 'intersect' | 'contain'
): string[] {
	return store.index.search(rect).filter((id) => {
		const box = store.index.get(id);
		if (!box) return false;
		if (mode === 'intersect') return rectsIntersect(box, rect);
		return (
			box.x >= rect.x &&
			box.y >= rect.y &&
			box.x + box.w <= rect.x + rect.w &&
			box.y + box.h <= rect.y + rect.h
		);
	});
}
