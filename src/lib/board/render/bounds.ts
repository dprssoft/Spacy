import type { Element, Rect } from '$lib/model/types';
import type { DiagramWorld } from '../diagram/endpoints';
import { connectorGeometry } from '../diagram/geometry';
import { boxAABB } from '../elements/common';
import { frameAABB } from '../elements/frame/geometry';
import { strokeAABB } from '../elements/stroke/geometry';
import { unionRects } from '../engine/geometry';

/** World bounds of an element, as the registry computes them (without importing it). */
export function elementBounds(el: Element, world: DiagramWorld): Rect {
	switch (el.type) {
		case 'frame':
			return frameAABB(el);
		case 'stroke':
			return strokeAABB(el);
		case 'connector':
			return connectorGeometry(el, world).bounds;
		default:
			return boxAABB(el);
	}
}

export function unionBounds(elements: readonly Element[], world: DiagramWorld): Rect | null {
	return elements.length ? unionRects(elements.map((el) => elementBounds(el, world))) : null;
}
