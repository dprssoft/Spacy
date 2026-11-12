import * as Y from 'yjs';
import { cloneElements } from './clone';
import { copyThreadsTo, deleteThreadsWhere, threadsOn } from './comments';
import { deleteWidgetEntries } from './widgets';
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
	/** The folder the page is in; absent for a page at the top level. */
	folder?: string;
}

/** A named group of pages in the tab strip (one level: folders don't nest). */
export interface PageFolder {
	id: string;
	name: string;
	collapsed: boolean;
}

/** A top-level entry of the tab strip: a page, or a folder with its pages. */
export type PageUnit =
	{ kind: 'page'; page: Page } | { kind: 'folder'; folder: PageFolder; pages: Page[] };

const KEY = 'pages';
const FOLDERS_KEY = 'pageFolders';
export const MAX_PAGE_NAME = 40;

function readFolders(doc: Y.Doc): PageFolder[] {
	const stored = getMeta(doc).get(FOLDERS_KEY);
	const folders = (Array.isArray(stored) ? stored : []).flatMap((f: unknown): PageFolder[] => {
		if (!f || typeof f !== 'object') return [];
		const { id, name, collapsed } = f as Record<string, unknown>;
		return typeof id === 'string' && id && typeof name === 'string'
			? [{ id, name, collapsed: collapsed === true }]
			: [];
	});
	return folders.filter((f, i) => folders.findIndex((g) => g.id === f.id) === i);
}

/**
 * Puts each folder's pages next to each other, where its first page is: concurrent edits (or an
 * older list) may have split them. A page naming an unknown folder is at the top level.
 */
function groupByFolder(pages: Page[], folders: readonly PageFolder[]): Page[] {
	const known = new Set(folders.map((f) => f.id));
	const clean = pages.map(({ folder, ...p }): Page =>
		folder && known.has(folder) ? { ...p, folder } : p
	);
	const out: Page[] = [];
	const done = new Set<string>();
	for (const p of clean) {
		if (!p.folder) out.push(p);
		else if (!done.has(p.folder)) {
			done.add(p.folder);
			out.push(...clean.filter((q) => q.folder === p.folder));
		}
	}
	return out;
}

/** The board's pages in order. A board without a stored list has a single "Page 1". */
export function getPages(doc: Y.Doc): Page[] {
	const stored = getMeta(doc).get(KEY);
	const pages = (Array.isArray(stored) ? stored : []).flatMap((p: unknown): Page[] => {
		if (!p || typeof p !== 'object') return [];
		const { id, name, folder } = p as Record<string, unknown>;
		if (typeof id !== 'string' || !id || typeof name !== 'string') return [];
		return [typeof folder === 'string' && folder ? { id, name, folder } : { id, name }];
	});
	const unique = pages.filter((p, i) => pages.findIndex((q) => q.id === p.id) === i);
	return unique.length > 0
		? groupByFolder(unique, readFolders(doc))
		: [{ id: MAIN_PAGE, name: 'Page 1' }];
}

/** The folders that hold at least one page, in tab strip order. */
export function getPageFolders(doc: Y.Doc): PageFolder[] {
	return foldersInUse(getPages(doc), readFolders(doc));
}

function foldersInUse(pages: readonly Page[], folders: readonly PageFolder[]): PageFolder[] {
	const order = [...new Set(pages.flatMap((p) => (p.folder ? [p.folder] : [])))];
	return order.flatMap((id) => folders.filter((f) => f.id === id));
}

/** Groups pages into tab strip entries. `pages` must be grouped (as `getPages` returns them). */
export function pageUnits(pages: readonly Page[], folders: readonly PageFolder[]): PageUnit[] {
	const units: PageUnit[] = [];
	for (const page of pages) {
		const folder = page.folder ? folders.find((f) => f.id === page.folder) : undefined;
		const last = units.at(-1);
		if (!folder) units.push({ kind: 'page', page });
		else if (last?.kind === 'folder' && last.folder.id === folder.id) last.pages.push(page);
		else units.push({ kind: 'folder', folder, pages: [page] });
	}
	return units;
}

/** Writes the page list; folders left without pages are dropped. */
function setPages(
	doc: Y.Doc,
	pages: Page[],
	origin: Origin = LOCAL,
	folders: PageFolder[] = readFolders(doc)
): void {
	const grouped = groupByFolder(pages, folders);
	const used = foldersInUse(grouped, folders);
	doc.transact(() => {
		const meta = getMeta(doc);
		meta.set(KEY, grouped);
		if (used.length > 0 || meta.has(FOLDERS_KEY)) meta.set(FOLDERS_KEY, used);
	}, origin);
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
	// A page added next to one in a folder goes into that folder.
	const folder = pages.find((p) => p.id === opts.afterId)?.folder;
	if (folder) page.folder = folder;
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

/**
 * Moves a page one position left (-1) or right (+1). A page in a folder moves among the folder's
 * pages and leaves the folder past its first or last page; a top-level page steps over a whole
 * folder.
 */
export function movePage(doc: Y.Doc, pageId: string, delta: -1 | 1): void {
	const pages = getPages(doc);
	const page = pages.find((p) => p.id === pageId);
	if (!page) return;
	const units = pageUnits(pages, readFolders(doc));
	if (page.folder) {
		const group = units.find((u) => u.kind === 'folder' && u.folder.id === page.folder);
		if (group?.kind !== 'folder') return;
		const i = group.pages.indexOf(page);
		const j = i + delta;
		if (j >= 0 && j < group.pages.length) {
			[group.pages[i], group.pages[j]] = [group.pages[j]!, group.pages[i]!];
		} else {
			group.pages.splice(i, 1);
			const at = units.indexOf(group) + (delta > 0 ? 1 : 0);
			units.splice(at, 0, { kind: 'page', page: { id: page.id, name: page.name } });
		}
	} else {
		const i = units.findIndex((u) => u.kind === 'page' && u.page.id === pageId);
		const j = i + delta;
		if (j < 0 || j >= units.length) return;
		[units[i], units[j]] = [units[j]!, units[i]!];
	}
	setPages(
		doc,
		units.flatMap((u) => (u.kind === 'page' ? [u.page] : u.pages))
	);
}

/** Moves a page so it ends up at `index` in the list; out-of-range indexes do nothing. */
export function movePageTo(doc: Y.Doc, pageId: string, index: number): void {
	const pages = getPages(doc);
	const i = pages.findIndex((p) => p.id === pageId);
	if (i < 0 || i === index || index < 0 || index >= pages.length) return;
	const next = pages.filter((p) => p.id !== pageId);
	next.splice(index, 0, pages[i]!);
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
		const removed = new Set<string>();
		for (const p of pages) {
			if (!ids.has(p.id)) continue;
			const map = pageElementsMap(doc, p.id);
			for (const id of [...map.keys()]) {
				map.delete(id);
				docs.delete(id);
				sketches.delete(id);
				removed.add(id);
			}
		}
		deleteThreadsWhere(doc, (id) => removed.has(id));
		deleteWidgetEntries(doc, removed);
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

/**
 * Deletes comment threads whose element is on no page (left behind by page deletes before they
 * removed comments, or by imported data). Run when a board opens; not undoable.
 */
export function pruneOrphanThreads(doc: Y.Doc, origin: Origin): void {
	const ids = new Set(allPageMaps(doc).flatMap((map) => [...map.keys()]));
	doc.transact(() => deleteThreadsWhere(doc, (id) => !ids.has(id)), origin);
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

// --- Folders -----------------------------------------------------------------------------------
// Like the other page-list edits, folder edits write `meta` and aren't undoable.

/** "Folder N" with the smallest N not used yet. */
export function nextFolderName(folders: readonly PageFolder[]): string {
	const names = new Set(folders.map((f) => f.name));
	let n = folders.length + 1;
	while (names.has(`Folder ${n}`)) n++;
	return `Folder ${n}`;
}

/**
 * Moves pages (in their current order) into `folder` (null: the top level), before the page
 * `before` (null: at the end of the folder, or of the list). A `before` page that isn't where the
 * pages can go (in another folder) moves them before its whole folder.
 */
export function placePages(
	doc: Y.Doc,
	pageIds: Iterable<string>,
	to: { before: string | null; folder: string | null }
): void {
	const folders = readFolders(doc);
	const folder = to.folder && folders.some((f) => f.id === to.folder) ? to.folder : null;
	const ids = new Set(pageIds);
	const pages = getPages(doc);
	const moving = pages
		.filter((p) => ids.has(p.id))
		.map((p): Page => (folder ? { ...p, folder } : { id: p.id, name: p.name }));
	if (moving.length === 0) return;
	const rest = pages.filter((p) => !ids.has(p.id));
	let at = rest.findIndex((p) => p.id === to.before);
	if (at >= 0 && rest[at]!.folder && rest[at]!.folder !== folder) {
		const start = rest.findIndex((p) => p.folder === rest[at]!.folder);
		at = start;
	}
	if (at < 0) {
		const lastInFolder = folder ? rest.findLastIndex((p) => p.folder === folder) : -1;
		at = lastInFolder >= 0 ? lastInFolder + 1 : rest.length;
	}
	rest.splice(at, 0, ...moving);
	setPages(doc, rest, LOCAL, folders);
}

/** Moves a folder with its pages before the page `before` (null: to the end). */
export function moveFolder(doc: Y.Doc, folderId: string, before: string | null): void {
	const pages = getPages(doc);
	const inside = pages.filter((p) => p.folder === folderId);
	if (inside.length === 0 || inside.some((p) => p.id === before)) return;
	const rest = pages.filter((p) => p.folder !== folderId);
	let at = rest.findIndex((p) => p.id === before);
	if (at >= 0 && rest[at]!.folder) at = rest.findIndex((p) => p.folder === rest[at]!.folder);
	rest.splice(at < 0 ? rest.length : at, 0, ...inside);
	setPages(doc, rest);
}

/**
 * Puts pages into a new folder where the first of them is (out of any folder they were in) and
 * returns it, or null if none of the ids is a page.
 */
export function createFolder(
	doc: Y.Doc,
	pageIds: Iterable<string>,
	name?: string
): PageFolder | null {
	const ids = new Set(pageIds);
	const pages = getPages(doc);
	const first = pages.find((p) => ids.has(p.id));
	if (!first) return null;
	const folders = readFolders(doc);
	const folder: PageFolder = {
		id: newId(),
		name: cleanName(name ?? '') || nextFolderName(getPageFolders(doc)),
		collapsed: false
	};
	// The folder takes the first page's place: before its old folder if it was in one.
	const anchor = first.folder ? pages.find((p) => p.folder === first.folder)! : first;
	const rest = pages.filter((p) => !ids.has(p.id));
	const moving = pages.filter((p) => ids.has(p.id)).map((p): Page => ({ ...p, folder: folder.id }));
	const next = pages.slice(pages.indexOf(anchor)).find((p) => !ids.has(p.id));
	rest.splice(next ? rest.indexOf(next) : rest.length, 0, ...moving);
	setPages(doc, rest, LOCAL, [...folders, folder]);
	return folder;
}

function updateFolder(doc: Y.Doc, folderId: string, patch: Partial<Omit<PageFolder, 'id'>>): void {
	const folders = getPageFolders(doc);
	const f = folders.find((g) => g.id === folderId);
	if (!f || Object.entries(patch).every(([k, v]) => f[k as keyof PageFolder] === v)) return;
	doc.transact(
		() =>
			getMeta(doc).set(
				FOLDERS_KEY,
				folders.map((g) => (g.id === folderId ? { ...g, ...patch } : g))
			),
		LOCAL
	);
}

/** Renames a folder; blank names are ignored. */
export function renameFolder(doc: Y.Doc, folderId: string, name: string): void {
	const next = cleanName(name);
	if (next) updateFolder(doc, folderId, { name: next });
}

/** Opens or closes a folder in the tab strip (stored on the board, so every tab sees it). */
export function setFolderCollapsed(doc: Y.Doc, folderId: string, collapsed: boolean): void {
	updateFolder(doc, folderId, { collapsed });
}

/** Removes a folder; its pages stay where they are, at the top level. */
export function ungroupFolder(doc: Y.Doc, folderId: string): void {
	const pages = getPages(doc);
	if (!pages.some((p) => p.folder === folderId)) return;
	setPages(
		doc,
		pages.map(({ folder, ...p }): Page => (folder && folder !== folderId ? { ...p, folder } : p))
	);
}

/**
 * Moves pages into a folder (at its end), or with null out of their folders: each lands right
 * after the folder it left.
 */
export function moveToFolder(
	doc: Y.Doc,
	pageIds: readonly string[],
	folderId: string | null
): void {
	if (folderId) {
		placePages(doc, pageIds, { before: null, folder: folderId });
		return;
	}
	for (const id of [...pageIds].reverse()) {
		const pages = getPages(doc);
		const page = pages.find((p) => p.id === id);
		if (!page?.folder) continue;
		const after = pages.findLastIndex((p) => p.folder === page.folder);
		placePages(doc, [id], { before: pages[after + 1]?.id ?? null, folder: null });
	}
}
