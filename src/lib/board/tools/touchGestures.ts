import type { Point } from '$lib/model/types';

// Finger gestures on the canvas, decided from pointer samples (pure; the pointer router feeds it).

/** Movement (screen px) under which a press is still a tap or a long-press. */
export const TAP_SLOP = 8;
export const LONG_PRESS_MS = 500;
export const DOUBLE_TAP_MS = 300;
export const DOUBLE_TAP_SLOP = 16;

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * One finger pressed on empty canvas: it becomes a pan (moved first), a long-press (held still),
 * or a tap (lifted quickly without moving).
 */
export class TouchPress {
	phase: 'pending' | 'pan' | 'longpress' = 'pending';

	constructor(
		readonly start: Point,
		readonly t0: number
	) {}

	move(p: Point): TouchPress['phase'] {
		if (this.phase === 'pending' && dist(p, this.start) > TAP_SLOP) this.phase = 'pan';
		return this.phase;
	}

	/** Call when the long-press timer fires; true when it became a long-press. */
	hold(now: number): boolean {
		if (this.phase !== 'pending' || now - this.t0 < LONG_PRESS_MS) return false;
		this.phase = 'longpress';
		return true;
	}

	isTap(p: Point): boolean {
		return this.phase === 'pending' && dist(p, this.start) <= TAP_SLOP;
	}
}

export interface Tap {
	at: Point;
	t: number;
}

/** A tap is quick and still: short press, little movement. */
export function isQuickTap(down: Tap, up: Tap): boolean {
	return up.t - down.t < LONG_PRESS_MS && dist(down.at, up.at) <= TAP_SLOP;
}

/** The second of two quick taps close together. */
export function isDoubleTap(prev: Tap | null, cur: Tap): boolean {
	return !!prev && cur.t - prev.t <= DOUBLE_TAP_MS && dist(prev.at, cur.at) <= DOUBLE_TAP_SLOP;
}
