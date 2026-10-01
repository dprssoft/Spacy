import type * as Y from 'yjs';
import { cloneHooks } from '$lib/model/clone';
import { getConnectorDefaults, getDefaultStyle } from '../style/styleDefaults';
import { getElement, getElementsMap, readElement } from '$lib/model/doc';
import { newId } from '$lib/model/ids';
import { beforeDeleteHooks, createElements, updateElements } from '$lib/model/ops';
import type {
	ConnectorElement,
	Element,
	ElementPatch,
	Endpoint,
	Marker,
	Routing,
	Style
} from '$lib/model/types';
import { resolveEndpoints, type DiagramWorld } from './endpoints';
import { boardWorld } from './world';

export interface ConnectorOptions {
	routing?: Routing;
	markerStart?: Marker;
	markerEnd?: Marker;
	style?: Style;
}

export function newConnector(
	from: Endpoint,
	to: Endpoint,
	opts: ConnectorOptions = {}
): Omit<ConnectorElement, 'z'> {
	const defaults = getConnectorDefaults();
	return {
		id: newId(),
		type: 'connector',
		x: 0,
		y: 0,
		w: 0,
		h: 0,
		rotation: 0,
		parentId: null,
		groupId: null,
		locked: false,
		style: opts.style ?? getDefaultStyle('connector'),
		from,
		to,
		routing: opts.routing ?? defaults.routing,
		waypoints: [],
		markerStart: opts.markerStart ?? defaults.markerStart,
		markerEnd: opts.markerEnd ?? defaults.markerEnd,
		label: { text: '', t: 0.5, background: true }
	};
}

export function createConnector(
	doc: Y.Doc,
	from: Endpoint,
	to: Endpoint,
	opts?: ConnectorOptions
): string {
	const c = newConnector(from, to, opts);
	createElements(doc, [c]);
	return c.id;
}

/** Elements read straight from the document (usable inside transactions, before the store updates). */
function docWorld(doc: Y.Doc): DiagramWorld {
	return boardWorld((id) => getElement(doc, id) ?? undefined);
}

/**
 * Converts the ends of connectors attached to elements that are being deleted into free ends at
 * their current position (so the connector stays where it was). Runs inside the delete transaction.
 */
export function detachConnectors(doc: Y.Doc, ids: ReadonlySet<string>): void {
	const world = docWorld(doc);
	const patches: { id: string; patch: ElementPatch }[] = [];
	for (const ymap of getElementsMap(doc).values()) {
		const c = readElement(ymap);
		if (!c || c.type !== 'connector' || ids.has(c.id)) continue;
		const hitsFrom = c.from.kind !== 'free' && ids.has(c.from.elementId);
		const hitsTo = c.to.kind !== 'free' && ids.has(c.to.elementId);
		if (!hitsFrom && !hitsTo) continue;
		const r = resolveEndpoints(c, world);
		const patch: ElementPatch = {};
		if (hitsFrom) patch.from = { kind: 'free', x: r.start.x, y: r.start.y };
		if (hitsTo) patch.to = { kind: 'free', x: r.end.x, y: r.end.y };
		patches.push({ id: c.id, patch });
	}
	if (patches.length) updateElements(doc, patches);
}

/** Copied connectors: ends on copied elements follow the copies; other ends become free. */
export function remapClonedConnector<E extends { type: string }>(
	el: E,
	idMap: ReadonlyMap<string, string>,
	offset: { x: number; y: number }
): E {
	if (el.type !== 'connector') return el;
	const c = el as unknown as ConnectorElement;
	const remap = (ep: Endpoint): Endpoint => {
		if (ep.kind === 'free') return { ...ep, x: ep.x + offset.x, y: ep.y + offset.y };
		const lastX = ep.lastX + offset.x;
		const lastY = ep.lastY + offset.y;
		const next = idMap.get(ep.elementId);
		return next ? { ...ep, elementId: next, lastX, lastY } : { kind: 'free', x: lastX, y: lastY };
	};
	return {
		...el,
		from: remap(c.from),
		to: remap(c.to),
		waypoints: c.waypoints.map((p) => ({ x: p.x + offset.x, y: p.y + offset.y }))
	} as E;
}

let installed = false;

/** Registers the connector hooks with the model (idempotent). */
export function installConnectorHooks(): void {
	if (installed) return;
	installed = true;
	beforeDeleteHooks.push(detachConnectors);
	cloneHooks.push(remapClonedConnector);
}

/** Connectors with at least one free end (e.g. after their element was deleted). */
export function danglingConnectors(els: Iterable<Element>): string[] {
	const out: string[] = [];
	for (const el of els) {
		if (el.type === 'connector' && (el.from.kind === 'free' || el.to.kind === 'free'))
			out.push(el.id);
	}
	return out;
}
