import * as Y from 'yjs';
import { cloneElements } from './clone';
import { copyThreadsTo, threadsOn } from './comments';
import {
	getActivePageId,
	getDocsMap,
	getMeta,
	getSketchesMap,
	MAIN_PAGE,
	pageElementsMap,
	readElement,
	setActivePageId,
	toYMap,
	type ElementYMap
} from './doc';
import { newId } from './ids';
import { LOCAL, PAGES, type Origin } from './origins';
import { getOutline, setOutline } from './outline';
import { parseElement } from './schema';
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
 * Deletes pages with everything on them (elements and their doc card contents). At least one page
 * always stays: returns false and changes nothing if that would delete every page, or if none of
 * the ids is a page. Not undoable: the content is removed outside the undo history.
 */
export function deletePages(doc: Y.Doc, pageIds: Iterable<string>): boolean {
	const pages = getPages(doc);
	const ids = new Set(pageIds);
	const kept = pages.filter((p) => !ids.has(p.id));
	if (kept.length === 0 || kept.length === pages.length) return false;
	doc.transact(() => {
		const docs = getDocsMap(doc);
		const sketches = getSketchesMap(doc);
		for (const p of pages) {
			if (!ids.has(p.id)) continue;
			const map = pageElementsMap(doc, p.id);
			for (const id of [...map.keys()]) {
				map.delete(id);
				docs.delete(id);
				sketches.delete(id);
			}
		}
	}, PAGES);
	// A stored list must exist from here on: without one, the first page would come back.
	setPages(doc, kept);
	if (ids.has(getActivePageId(doc))) setActivePageId(doc, kept[0]!.id);
	return true;
}

/** Deletes one page; see `deletePages`. The last page can't be deleted. */
export function deletePage(doc: Y.Doc, pageId: string): boolean {
	return deletePages(doc, [pageId]);
}

/** "<name> copy", cut to fit the name limit. */
export const copyName = (name: string): string =>
	`${name.slice(0, MAX_PAGE_NAME - ' copy'.length).trimEnd()} copy`;

/**
 * Adds a copy of a page right after it: every element with a new id (connectors, frames and
 * groups follow the copies), doc card contents, sketch strokes, comments and the doc card outline.
 * Like adding a page, it isn't undoable. Returns the new page, or null if the page doesn't exist.
 */
export function duplicatePage(doc: Y.Doc, pageId: string): Page | null {
	const source = getPages(doc).find((p) => p.id === pageId);
	if (!source) return null;
	const els: Element[] = [];
	for (const ymap of pageElementsMap(doc, pageId).values()) {
		const el = readElement(ymap);
		if (el) els.push(el);
	}
	const { elements, idMap } = cloneElements(els, { offset: { x: 0, y: 0 } });
	const threads = threadsOn(doc, new Set(idMap.keys()));
	let page: Page | null = null;
	doc.transact(() => {
		page = addPage(doc, { name: copyName(source.name), afterId: pageId });
		const map = pageElementsMap(doc, page.id);
		const docs = getDocsMap(doc);
		const sketches = getSketchesMap(doc);
		elements.forEach((input, i) => {
			// Same stacking order as the original.
			const el = parseElement({ ...input, z: els[i]!.z });
			if (!el) return;
			map.set(el.id, toYMap(el));
			const frag = docs.get(els[i]!.id);
			if (frag) docs.set(el.id, frag.clone());
			const strokes = sketches.get(els[i]!.id);
			if (strokes) {
				const arr = new Y.Array<unknown>();
				arr.push(strokes.toArray());
				sketches.set(el.id, arr);
			}
		});
		copyThreadsTo(doc, threads, idMap, page.id);
		const outline = getOutline(doc, pageId).flatMap((id) => idMap.get(id) ?? []);
		if (outline.length > 0) setOutline(doc, page.id, outline);
	}, PAGES);
	return page;
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
