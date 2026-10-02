import type * as Y from 'yjs';
import {
	getActivePageId,
	getDocsMap,
	getMeta,
	MAIN_PAGE,
	pageElementsMap,
	readElement,
	setActivePageId,
	type ElementYMap
} from './doc';
import { newId } from './ids';
import { LOCAL, PAGES, type Origin } from './origins';
import type { Element } from './types';

// Pages ("sheets") of a board. The list lives in `meta.pages`; each page's elements are their own
// Y.Map (`elements` for the first page, `page:<id>` for the others). Doc card contents stay in the
// shared `docs` map, keyed by element id.

export interface Page {
	id: string;
	name: string;
}

const KEY = 'pages';
export const MAX_PAGE_NAME = 40;

/** The board's pages in order. A board without a stored list has a single "Page 1". */
export function getPages(doc: Y.Doc): Page[] {
	const stored = getMeta(doc).get(KEY);
	const pages = (Array.isArray(stored) ? stored : []).flatMap((p: unknown): Page[] => {
		if (!p || typeof p !== 'object') return [];
		const { id, name } = p as Record<string, unknown>;
		return typeof id === 'string' && id && typeof name === 'string' ? [{ id, name }] : [];
	});
	const unique = pages.filter((p, i) => pages.findIndex((q) => q.id === p.id) === i);
	return unique.length > 0 ? unique : [{ id: MAIN_PAGE, name: 'Page 1' }];
}

function setPages(doc: Y.Doc, pages: Page[], origin: Origin = LOCAL): void {
	doc.transact(() => getMeta(doc).set(KEY, pages), origin);
}

/** The active page of this tab, falling back to the first page if it no longer exists. */
export function activePage(doc: Y.Doc): Page {
	const pages = getPages(doc);
	return pages.find((p) => p.id === getActivePageId(doc)) ?? pages[0]!;
}

export function setActivePage(doc: Y.Doc, pageId: string): void {
	setActivePageId(doc, pageId);
}

/** "Page N" with the smallest N not used yet. */
export function nextPageName(pages: readonly Page[]): string {
	const names = new Set(pages.map((p) => p.name));
	let n = pages.length + 1;
	while (names.has(`Page ${n}`)) n++;
	return `Page ${n}`;
}

const cleanName = (name: string) => name.trim().replace(/\s+/g, ' ').slice(0, MAX_PAGE_NAME);

/** Adds an empty page after `afterId` (default: at the end) and returns it. */
export function addPage(doc: Y.Doc, opts: { name?: string; afterId?: string } = {}): Page {
	const pages = getPages(doc);
	const page: Page = { id: newId(), name: cleanName(opts.name ?? '') || nextPageName(pages) };
	const at = opts.afterId ? pages.findIndex((p) => p.id === opts.afterId) + 1 : pages.length;
	setPages(doc, [...pages.slice(0, at || pages.length), page, ...pages.slice(at || pages.length)]);
	return page;
}

/** Renames a page; blank names are ignored. */
export function renamePage(doc: Y.Doc, pageId: string, name: string): void {
	const next = cleanName(name);
	const pages = getPages(doc);
	if (!next || !pages.some((p) => p.id === pageId && p.name !== next)) return;
	setPages(
		doc,
		pages.map((p) => (p.id === pageId ? { ...p, name: next } : p))
	);
}

/** Moves a page one position left (-1) or right (+1). */
export function movePage(doc: Y.Doc, pageId: string, delta: -1 | 1): void {
	const pages = getPages(doc);
	const i = pages.findIndex((p) => p.id === pageId);
	const j = i + delta;
	if (i < 0 || j < 0 || j >= pages.length) return;
	const next = [...pages];
	[next[i], next[j]] = [next[j]!, next[i]!];
	setPages(doc, next);
}

/**
 * Deletes a page with everything on it (elements and their doc card contents). The last page
 * can't be deleted. Not undoable: the content is removed outside the undo history.
 */
export function deletePage(doc: Y.Doc, pageId: string): boolean {
	const pages = getPages(doc);
	if (pages.length <= 1 || !pages.some((p) => p.id === pageId)) return false;
	doc.transact(() => {
		const map = pageElementsMap(doc, pageId);
		const docs = getDocsMap(doc);
		for (const id of [...map.keys()]) {
			map.delete(id);
			docs.delete(id);
		}
	}, PAGES);
	// A stored list must exist from here on: without one, the first page would come back.
	setPages(
		doc,
		pages.filter((p) => p.id !== pageId)
	);
	if (getActivePageId(doc) === pageId) setActivePageId(doc, getPages(doc)[0]!.id);
	return true;
}

/** Every page's element map, in page order. */
export function allPageMaps(doc: Y.Doc): Y.Map<ElementYMap>[] {
	return getPages(doc).map((p) => pageElementsMap(doc, p.id));
}

/** All valid elements on all pages (asset cleanup, import, duplication). */
export function listAllElements(doc: Y.Doc): Element[] {
	const out: Element[] = [];
	for (const map of allPageMaps(doc))
		for (const ymap of map.values()) {
			const el = readElement(ymap);
			if (el) out.push(el);
		}
	return out;
}

/** The page an element is on, or null. */
export function pageOfElement(doc: Y.Doc, elementId: string): string | null {
	return getPages(doc).find((p) => pageElementsMap(doc, p.id).has(elementId))?.id ?? null;
}
