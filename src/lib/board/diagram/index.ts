import type { Element, Point, Port } from '$lib/model/types';
import { definitionOf } from '../elements';
import type { Connectable } from './connectable';
import { PORTS } from './connectable';

export function getConnectable(el: Element): Connectable | null {
	return definitionOf(el).connectable;
}

export const isConnectable = (el: Element): boolean => getConnectable(el) !== null;

/** The port within `radius` of `p` (nearest first), or null. */
export function nearestPort(el: Element, p: Point, radius: number): Port | null {
	const c = getConnectable(el);
	if (!c) return null;
	const ports = c.ports(el);
	let best: Port | null = null;
	let bestD = radius;
	for (const port of PORTS) {
		const q = ports[port];
		const d = Math.hypot(q.x - p.x, q.y - p.y);
		if (d <= bestD) {
			best = port;
			bestD = d;
		}
	}
	return best;
}

export { boxConnectable, polygonConnectable, PORTS, type Connectable } from './connectable';
