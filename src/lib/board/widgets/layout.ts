import type { Point, Rect, WidgetElement } from '$lib/model/types';
import { widgetView, type WidgetAction } from './kinds';

/** How a design space fits a box: scaled uniformly and centred (SVG's `xMidYMid meet`). */
export function fitDesign(design: { w: number; h: number }, box: { w: number; h: number }) {
	const scale = Math.min(box.w / design.w, box.h / design.h);
	return {
		scale,
		dx: (box.w - design.w * scale) / 2,
		dy: (box.h - design.h * scale) / 2
	};
}

const inside = (r: Rect, p: Point) =>
	p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

/** The action under a world point (widgets aren't rotatable), or null. */
export function actionAt(el: WidgetElement, p: Point, now: number): WidgetAction | null {
	const { actions, design } = widgetView(el, now);
	if (actions.length === 0) return null;
	const { scale, dx, dy } = fitDesign(design, el);
	if (scale <= 0) return null;
	const local = { x: (p.x - el.x - dx) / scale, y: (p.y - el.y - dy) / scale };
	return actions.find((a) => inside(a.rect, local)) ?? null;
}

/** The primary action (Enter), if any. */
export function primaryAction(el: WidgetElement, now: number): WidgetAction | null {
	return widgetView(el, now).actions.find((a) => a.primary) ?? null;
}
