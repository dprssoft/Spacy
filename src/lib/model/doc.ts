import * as Y from 'yjs';
import { parseElement } from './schema';
import type { Element } from './types';
import { compareZ } from './zorder';

export type ElementYMap = Y.Map<unknown>;

export const getMeta = (doc: Y.Doc): Y.Map<unknown> => doc.getMap('meta');
export const getElementsMap = (doc: Y.Doc): Y.Map<ElementYMap> => doc.getMap('elements');
export const getDocsMap = (doc: Y.Doc): Y.Map<Y.XmlFragment> => doc.getMap('docs');

/** Plain snapshot of a stored element; null if the stored data is invalid. */
export function readElement(ymap: ElementYMap): Element | null {
	return parseElement(ymap.toJSON());
}

/** One Y.Map key per top-level field. Object/array fields are stored as plain JSON values. */
export function toYMap(el: Element): ElementYMap {
	return new Y.Map<unknown>(Object.entries(structuredClone(el)));
}

/** All valid elements, sorted by z. */
export function listElements(doc: Y.Doc): Element[] {
	const out: Element[] = [];
	for (const ymap of getElementsMap(doc).values()) {
		const el = readElement(ymap);
		if (el) out.push(el);
	}
	return out.sort((a, b) => compareZ(a.z, b.z));
}

export function getElement(doc: Y.Doc, id: string): Element | null {
	const ymap = getElementsMap(doc).get(id);
	return ymap ? readElement(ymap) : null;
}

function extremeZ(doc: Y.Doc, pick: 'max' | 'min'): string | null {
	let best: string | null = null;
	for (const ymap of getElementsMap(doc).values()) {
		const z = ymap.get('z');
		if (typeof z !== 'string') continue;
		if (best === null || (pick === 'max' ? z > best : z < best)) best = z;
	}
	return best;
}

export const maxZ = (doc: Y.Doc): string | null => extremeZ(doc, 'max');
export const minZ = (doc: Y.Doc): string | null => extremeZ(doc, 'min');
