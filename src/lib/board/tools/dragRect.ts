import type { Point, Rect } from '$lib/model/types';

/**
 * The rect drawn by dragging from `start` to `current`.
 * `square` keeps equal sides (Shift); `fromCenter` grows around `start` (Alt).
 */
export function dragRect(
	start: Point,
	current: Point,
	opts: { square?: boolean; fromCenter?: boolean; minSize?: number } = {}
): Rect {
	const min = opts.minSize ?? 1;
	let dx = current.x - start.x;
	let dy = current.y - start.y;
	if (opts.square) {
		const side = Math.max(Math.abs(dx), Math.abs(dy));
		dx = Math.sign(dx || 1) * side;
		dy = Math.sign(dy || 1) * side;
	}
	if (opts.fromCenter) {
		const w = Math.max(min, Math.abs(dx) * 2);
		const h = Math.max(min, Math.abs(dy) * 2);
		return { x: start.x - w / 2, y: start.y - h / 2, w, h };
	}
	return {
		x: dx < 0 ? start.x + dx : start.x,
		y: dy < 0 ? start.y + dy : start.y,
		w: Math.max(min, Math.abs(dx)),
		h: Math.max(min, Math.abs(dy))
	};
}
