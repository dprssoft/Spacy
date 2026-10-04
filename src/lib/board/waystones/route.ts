import { ZOOM_MAX, ZOOM_MIN } from '$lib/model/defaults';
import type { Element, Point, WaystoneElement } from '$lib/model/types';
import { zBetween } from '$lib/model/zorder';
import type { Size, Viewport } from '../engine/viewport';
import { PIN_H, PIN_W } from './pin';

/** A page's waystones in route order (fractional `order`, ties by id: copies share a key). */
export function routeOf(elements: Iterable<Element>): WaystoneElement[] {
	const out: WaystoneElement[] = [];
	for (const el of elements) if (el.type === 'waystone') out.push(el);
	return out.sort((a, b) =>
		a.order < b.order ? -1 : a.order > b.order ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0
	);
}

/** The order key after the last waystone. */
export const orderAfter = (route: readonly WaystoneElement[]): string =>
	zBetween(route.at(-1)?.order ?? null, null);

/**
 * The order key that moves `route[from]` to index `to` (in the route without it), or null when
 * nothing changes.
 */
export function orderForMove(
	route: readonly WaystoneElement[],
	from: number,
	to: number
): string | null {
	const rest = route.filter((_, i) => i !== from);
	const target = Math.max(0, Math.min(rest.length, to));
	if (target === from) return null;
	const before = rest[target - 1]?.order ?? null;
	const after = rest[target]?.order ?? null;
	// Equal neighbours (copies): a key strictly between them doesn't exist; go just after `before`.
	if (before !== null && after !== null && before >= after) return zBetween(before, null);
	return zBetween(before, after);
}

/** The index after stepping `dir` from `current` (-1 = none yet), or null at an end without wrap. */
export function stepIndex(
	current: number,
	count: number,
	dir: 1 | -1,
	wrap: boolean
): number | null {
	if (count === 0) return null;
	if (current < 0 || current >= count) return dir > 0 ? 0 : count - 1;
	const next = current + dir;
	if (next >= 0 && next < count) return next;
	return wrap ? (next + count) % count : null;
}

/** Where a waystone points: its pin's tip. */
export const anchorOf = (w: Pick<WaystoneElement, 'x' | 'y'>): Point => ({
	x: w.x + PIN_W / 2,
	y: w.y + PIN_H
});

/** The box of a waystone whose tip is at `p`. */
export const boxAt = (p: Point) => ({ x: p.x - PIN_W / 2, y: p.y - PIN_H, w: PIN_W, h: PIN_H });

export const clampWaystoneZoom = (z: number): number =>
	Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number.isFinite(z) ? z : 1));

/** The view that centres a waystone's tip at its zoom. */
export function flyTarget(w: WaystoneElement, size: Size): Viewport {
	const zoom = clampWaystoneZoom(w.zoom);
	const a = anchorOf(w);
	return { x: size.w / 2 - a.x * zoom, y: size.h / 2 - a.y * zoom, zoom };
}
