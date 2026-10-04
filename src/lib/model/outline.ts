import * as Y from 'yjs';
import { getMeta } from './doc';
import { LOCAL, MIGRATION, type Origin } from './origins';

// The manuscript order of doc cards, per page: `meta.outline` is a Y.Map<pageId, string[]>.
// A nested map (not a JSON value) so it can be in canvas undo scope without the rest of `meta`.

/** The outline map, created (not undoably) when missing. Call before setting up undo. */
export function ensureOutlineMap(doc: Y.Doc): Y.Map<unknown> {
	const existing = getMeta(doc).get('outline');
	if (existing instanceof Y.Map) return existing;
	doc.transact(() => getMeta(doc).set('outline', new Y.Map()), MIGRATION);
	return getMeta(doc).get('outline') as Y.Map<unknown>;
}

export function getOutline(doc: Y.Doc, pageId: string): string[] {
	const map = getMeta(doc).get('outline');
	const v = map instanceof Y.Map ? map.get(pageId) : undefined;
	return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

export function setOutline(
	doc: Y.Doc,
	pageId: string,
	ids: readonly string[],
	origin: Origin = LOCAL
): void {
	doc.transact(() => ensureOutlineMap(doc).set(pageId, [...ids]), origin);
}
