import type { Element, ShapeElement } from '$lib/model/types';
import { boxConnectable, polygonConnectable, type Connectable } from '../diagram/connectable';
import type { DiagramWorld } from '../diagram/endpoints';
import { shapeOutline } from './shape/paths';

export const shapeConnectable = polygonConnectable<ShapeElement>((el) =>
	shapeOutline(el.kind, el.w, el.h)
);

/** How connectors attach to `el` (null for connectors). Pure: usable without the registry. */
export function connectableFor(el: Element): Connectable | null {
	if (el.type === 'connector') return null;
	return (el.type === 'shape' ? shapeConnectable : boxConnectable) as Connectable;
}

/** A diagram world over any element lookup, without the (Svelte) element registry. */
export function pureWorld(get: (id: string) => Element | undefined): DiagramWorld {
	return { get, connectable: connectableFor };
}
