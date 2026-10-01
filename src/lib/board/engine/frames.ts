import type { FrameElement, Rect } from '$lib/model/types';
import { compareZ } from '$lib/model/zorder';

export function containsRect(outer: Rect, inner: Rect): boolean {
	return (
		inner.x >= outer.x &&
		inner.y >= outer.y &&
		inner.x + inner.w <= outer.x + outer.w &&
		inner.y + inner.h <= outer.y + outer.h
	);
}

/** The topmost frame fully containing `aabb`, or null. Frames are never nested. */
export function frameFor(aabb: Rect, frames: readonly FrameElement[]): string | null {
	let best: FrameElement | null = null;
	for (const f of frames) {
		if (!containsRect(f, aabb)) continue;
		if (!best || compareZ(f.z, best.z) > 0) best = f;
	}
	return best?.id ?? null;
}
