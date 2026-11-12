import { describe, expect, it } from 'vitest';
import { pageUnits, type Page, type PageFolder } from '$lib/model/pages';
import { folderDrop, isNoopPageDrop, itemKey, pageDrop, stripItems } from './pageStrip';

const pages: Page[] = [
	{ id: 'a', name: 'A' },
	{ id: 'b', name: 'B', folder: 'f' },
	{ id: 'c', name: 'C', folder: 'f' },
	{ id: 'd', name: 'D' },
	{ id: 'e', name: 'E', folder: 'g' }
];
const folders = (collapsed = false): PageFolder[] => [
	{ id: 'f', name: 'F', collapsed },
	{ id: 'g', name: 'G', collapsed: true }
];
const items = (current = 'a', collapsed = false) =>
	stripItems(pageUnits(pages, folders(collapsed)), current);
const page = (id: string) => pages.find((p) => p.id === id)!;

describe('page strip', () => {
	it('shows chips, open folders’ pages, and the current page of a closed folder', () => {
		expect(items().map(itemKey)).toEqual(['a', 'folder:f', 'b', 'c', 'd', 'folder:g']);
		expect(items('e', true).map(itemKey)).toEqual(['a', 'folder:f', 'd', 'folder:g', 'e']);
	});

	// Strip: a | F | b c | d | G
	it('a page dropped before a page of an open folder joins it; elsewhere it is top level', () => {
		const s = items();
		expect(pageDrop(s, 3, 'a')).toEqual({ before: 'c', folder: 'f' });
		expect(pageDrop(s, 2, 'a')).toEqual({ before: 'b', folder: 'f' });
		expect(pageDrop(s, 1, 'd')).toEqual({ before: 'b', folder: null });
		expect(pageDrop(s, 4, 'b')).toEqual({ before: 'd', folder: null });
		expect(pageDrop(s, 5, 'a')).toEqual({ before: 'e', folder: null });
		expect(pageDrop(s, 6, 'a')).toEqual({ before: null, folder: null });
	});

	it('dropping a tab next to itself is a no-op unless it changes folder', () => {
		const s = items();
		expect(isNoopPageDrop(s, 2, page('b'))).toBe(true);
		expect(isNoopPageDrop(s, 3, page('b'))).toBe(true);
		expect(isNoopPageDrop(s, 4, page('c'))).toBe(false); // last in F → out of it
		expect(isNoopPageDrop(s, 1, page('a'))).toBe(true);
		expect(isNoopPageDrop(s, 4, page('d'))).toBe(true);
		expect(isNoopPageDrop(s, 0, page('d'))).toBe(false);
	});

	it('a folder drops before the tab in the gap, never inside itself', () => {
		const s = items();
		expect(folderDrop(s, 0, 'f')).toBe('a');
		expect(folderDrop(s, 2, 'f')).toBeUndefined();
		expect(folderDrop(s, 4, 'f')).toBeUndefined();
		expect(folderDrop(s, 5, 'f')).toBe('e');
		expect(folderDrop(s, 6, 'f')).toBeNull();
		expect(folderDrop(s, 1, 'g')).toBe('b');
	});
});
