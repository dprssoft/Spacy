import type { Point, Rect, WidgetElement } from '$lib/model/types';
import { readWidget, widgetView, type WidgetAction } from './kinds';

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

/** A world point in the widget's design space (widgets aren't rotatable); null if it has no size. */
export function toDesign(
	el: WidgetElement,
	design: { w: number; h: number },
	p: Point
): Point | null {
	const { scale, dx, dy } = fitDesign(design, el);
	if (scale <= 0) return null;
	return { x: (p.x - el.x - dx) / scale, y: (p.y - el.y - dy) / scale };
}

/** The action under a world point, or null. */
export function actionAt(el: WidgetElement, p: Point, now: number): WidgetAction | null {
	const { actions, design } = widgetView(el, now);
	if (actions.length === 0) return null;
	const local = toDesign(el, design, p);
	return local ? (actions.find((a) => inside(a.rect, local)) ?? null) : null;
}

/** The config a drag on `action` at world point `p` sets, or null (not a drag zone, no change). */
export function dragConfig(el: WidgetElement, action: string, p: Point, fine: boolean): unknown {
	const w = readWidget(el);
	if (!w?.def.dragTo) return null;
	const local = toDesign(el, w.def.design, p);
	return local ? w.def.dragTo(action, w.config, local, fine) : null;
}

/** The primary action (Enter), if any. */
export function primaryAction(el: WidgetElement, now: number): WidgetAction | null {
	return widgetView(el, now).actions.find((a) => a.primary) ?? null;
}
