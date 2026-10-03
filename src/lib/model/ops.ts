import * as Y from 'yjs';
import {
	forgetWritten,
	getDocsMap,
	getElementsMap,
	getMeta,
	getSketchesMap,
	maxZ,
	rememberWritten,
	toYMap,
	type ElementYMap
} from './doc';
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
		const sketches = getSketchesMap(doc);
		const keys = zManyAbove(maxZ(doc), els.filter((e) => e.z === undefined).length);
		let k = 0;
		for (const input of els) {
			const el = parseElement({ ...input, z: input.z ?? keys[k++] });
			if (!el) throw new InvalidElementError(`Invalid ${input.type} element`, input);
			if (map.has(el.id)) throw new InvalidElementError(`Duplicate element id ${el.id}`, input);
			map.set(el.id, toYMap(el));
			if (el.type === 'doccard' && !docs.has(el.id)) docs.set(el.id, new Y.XmlFragment());
			if (el.type === 'sketch' && !sketches.has(el.id)) sketches.set(el.id, new Y.Array());
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
	const written: ElementYMap[] = [];
	try {
		doc.transact(() => {
			const map = getElementsMap(doc);
			for (const { id, patch } of patches) {
				const ymap = map.get(id);
				if (!ymap) continue;
				// One validation, of the result: a valid result implies a valid patch. The stored
				// element is validated only when the result isn't (to skip it if it was invalid).
				const cur = ymap.toJSON();
				if ('id' in patch && patch.id !== id) {
					throw new InvalidElementError('Cannot change an element id', patch);
				}
				if ('type' in patch && patch.type !== cur.type) {
					throw new InvalidElementError('Cannot change an element type', patch);
				}
				const next = parseElement({ ...cur, ...patch });
				if (!next) {
					if (!parseElement(cur)) continue;
					throw new InvalidElementError(`Invalid patch for ${String(cur.type)} ${id}`, patch);
				}
				let size = 0;
				for (const [key, value] of Object.entries(next)) {
					if (value !== undefined) size++;
					if (!jsonEqual(cur[key], value)) ymap.set(key, structuredClone(value));
				}
				// Only when the map holds exactly `next` (no stale keys left beside it).
				if (ymap.size === size) {
					rememberWritten(ymap, next);
					written.push(ymap);
				}
			}
		}, origin);
	} finally {
		for (const ymap of written) forgetWritten(ymap);
	}
}

/** Deletes elements (and doc card contents and sketch strokes). Unknown ids are ignored. */
export function deleteElements(doc: Y.Doc, ids: Iterable<string>, origin: Origin = LOCAL): void {
	doc.transact(() => {
		const map = getElementsMap(doc);
		const docs = getDocsMap(doc);
		const sketches = getSketchesMap(doc);
		const set = new Set([...ids].filter((id) => map.has(id)));
		for (const hook of beforeDeleteHooks) hook(doc, set);
		for (const id of set) {
			map.delete(id);
			docs.delete(id);
			sketches.delete(id);
		}
	}, origin);
}

export function setMeta(doc: Y.Doc, key: string, value: unknown, origin: Origin = LOCAL): void {
	doc.transact(() => getMeta(doc).set(key, value), origin);
}

/**
 * Adds one brush stroke to a sketch, in one transaction (one undo step): optionally creates the
 * sketch element first, and applies `patch` (its frame, which grows with the drawing).
 */
export function addSketchStroke(
	doc: Y.Doc,
	opts: { id: string; stroke: unknown; create?: NewElement; patch?: ElementPatch },
	origin: Origin = LOCAL
): void {
	doc.transact(() => {
		if (opts.create) createElements(doc, [opts.create], origin);
		if (opts.patch) updateElements(doc, [{ id: opts.id, patch: opts.patch }], origin);
		const sketches = getSketchesMap(doc);
		let strokes = sketches.get(opts.id);
		if (!strokes) sketches.set(opts.id, (strokes = new Y.Array()));
		strokes.push([opts.stroke]);
	}, origin);
}

/** Sets a sketch's strokes (copies made by paste and duplicate). */
export function setSketchStrokes(
	doc: Y.Doc,
	id: string,
	strokes: readonly unknown[],
	origin: Origin = LOCAL
): void {
	doc.transact(() => {
		const arr = new Y.Array<unknown>();
		arr.push([...strokes]);
		getSketchesMap(doc).set(id, arr);
	}, origin);
}
