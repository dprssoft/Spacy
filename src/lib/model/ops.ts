import * as Y from 'yjs';
import { getDocsMap, getElementsMap, getMeta, maxZ, readElement, toYMap } from './doc';
import { jsonEqual } from './equal';
import { LOCAL, type Origin } from './origins';
import { parseElement } from './schema';
import type { Element, ElementPatch, NewElement } from './types';
import { zManyAbove } from './zorder';

// The only functions that write elements to a Y.Doc. Each runs in a single transaction.

export class InvalidElementError extends Error {
	constructor(
		message: string,
		readonly input: unknown
	) {
		super(message);
		this.name = 'InvalidElementError';
	}
}

/**
 * Run inside the delete transaction before anything is removed. Hooks may add ids to the set
 * (e.g. frame children) or rewrite other elements (e.g. detach connectors, step 20).
 */
export const beforeDeleteHooks: ((doc: Y.Doc, ids: Set<string>) => void)[] = [];

/** Creates elements; those without `z` get keys above the current top, in the given order. */
export function createElements(
	doc: Y.Doc,
	els: readonly NewElement[],
	origin: Origin = LOCAL
): Element[] {
	const created: Element[] = [];
	doc.transact(() => {
		const map = getElementsMap(doc);
		const docs = getDocsMap(doc);
		const keys = zManyAbove(maxZ(doc), els.filter((e) => e.z === undefined).length);
		let k = 0;
		for (const input of els) {
			const el = parseElement({ ...input, z: input.z ?? keys[k++] });
			if (!el) throw new InvalidElementError(`Invalid ${input.type} element`, input);
			if (map.has(el.id)) throw new InvalidElementError(`Duplicate element id ${el.id}`, input);
			map.set(el.id, toYMap(el));
			if (el.type === 'doccard' && !docs.has(el.id)) docs.set(el.id, new Y.XmlFragment());
			created.push(el);
		}
	}, origin);
	return created;
}

export function updateElement(
	doc: Y.Doc,
	id: string,
	patch: ElementPatch,
	origin: Origin = LOCAL
): void {
	updateElements(doc, [{ id, patch }], origin);
}

/** Applies patches; only keys whose value actually changes are written. Missing ids are skipped. */
export function updateElements(
	doc: Y.Doc,
	patches: readonly { id: string; patch: ElementPatch }[],
	origin: Origin = LOCAL
): void {
	doc.transact(() => {
		const map = getElementsMap(doc);
		for (const { id, patch } of patches) {
			const ymap = map.get(id);
			if (!ymap) continue;
			const current = readElement(ymap);
			if (!current) continue;
			if ('id' in patch && patch.id !== id) {
				throw new InvalidElementError('Cannot change an element id', patch);
			}
			if ('type' in patch && patch.type !== current.type) {
				throw new InvalidElementError('Cannot change an element type', patch);
			}
			const next = parseElement({ ...current, ...patch });
			if (!next) throw new InvalidElementError(`Invalid patch for ${current.type} ${id}`, patch);
			const cur = current as unknown as Record<string, unknown>;
			for (const [key, value] of Object.entries(next)) {
				if (!jsonEqual(cur[key], value)) ymap.set(key, structuredClone(value));
			}
		}
	}, origin);
}

/** Deletes elements (and doc card contents). Unknown ids are ignored. */
export function deleteElements(doc: Y.Doc, ids: Iterable<string>, origin: Origin = LOCAL): void {
	doc.transact(() => {
		const map = getElementsMap(doc);
		const docs = getDocsMap(doc);
		const set = new Set([...ids].filter((id) => map.has(id)));
		for (const hook of beforeDeleteHooks) hook(doc, set);
		for (const id of set) {
			map.delete(id);
			docs.delete(id);
		}
	}, origin);
}

export function setMeta(doc: Y.Doc, key: string, value: unknown, origin: Origin = LOCAL): void {
	doc.transact(() => getMeta(doc).set(key, value), origin);
}
