import type { Page, PageFolder, PageUnit } from '$lib/model/pages';

// What the sheet tab strip shows (folder chips and page tabs) and where a dragged tab lands.

export type StripItem =
	{ kind: 'folder'; folder: PageFolder; pages: Page[] } | { kind: 'page'; page: Page };

/**
 * The strip's tabs in order: each folder's chip, then its pages if it's open. A closed folder
 * still shows the current page, so the page on screen always has a tab.
 */
export function stripItems(units: readonly PageUnit[], current: string): StripItem[] {
	return units.flatMap((u): StripItem[] => {
		if (u.kind === 'page') return [u];
		const shown = u.folder.collapsed ? u.pages.filter((p) => p.id === current) : u.pages;
		return [u, ...shown.map((page): StripItem => ({ kind: 'page', page }))];
	});
}

export const itemKey = (item: StripItem): string =>
	item.kind === 'page' ? item.page.id : `folder:${item.folder.id}`;

/** The first tab at or after strip position `i` that isn't skipped: what a drop lands before. */
function next(items: readonly StripItem[], i: number, skip: (item: StripItem) => boolean) {
	return items.slice(i).find((item) => !skip(item));
}

const firstPage = (item: StripItem): string =>
	item.kind === 'page' ? item.page.id : item.pages[0]!.id;

/**
 * Where a page tab dropped into gap `slot` goes: before a page in an open folder joins that
 * folder; anywhere else is the top level (before a folder chip = before the whole folder).
 */
export function pageDrop(
	items: readonly StripItem[],
	slot: number,
	pageId: string
): { before: string | null; folder: string | null } {
	const r = next(items, slot, (item) => item.kind === 'page' && item.page.id === pageId);
	if (!r) return { before: null, folder: null };
	if (r.kind === 'folder') return { before: firstPage(r), folder: null };
	return { before: r.page.id, folder: r.page.folder ?? null };
}

/** Whether dropping a page tab there leaves everything as it is. */
export function isNoopPageDrop(items: readonly StripItem[], slot: number, page: Page): boolean {
	const from = items.findIndex((item) => item.kind === 'page' && item.page.id === page.id);
	if (from < 0 || (slot !== from && slot !== from + 1)) return false;
	return pageDrop(items, slot, page.id).folder === (page.folder ?? null);
}

/** The strip positions a folder chip and its shown pages take. */
function folderSpan(items: readonly StripItem[], folderId: string): [number, number] {
	const from = items.findIndex((item) => item.kind === 'folder' && item.folder.id === folderId);
	let to = from + 1;
	const inFolder = (item: StripItem | undefined) =>
		item?.kind === 'page' && item.page.folder === folderId;
	while (to < items.length && inFolder(items[to])) to++;
	return [from, to];
}

/**
 * Where a folder chip dropped into gap `slot` goes: before the page there (the model keeps it
 * out of other folders), null for the end, or undefined when it stays where it is.
 */
export function folderDrop(
	items: readonly StripItem[],
	slot: number,
	folderId: string
): string | null | undefined {
	const [from, to] = folderSpan(items, folderId);
	if (from < 0 || (slot >= from && slot <= to)) return undefined;
	const r = items[slot];
	return r ? firstPage(r) : null;
}
