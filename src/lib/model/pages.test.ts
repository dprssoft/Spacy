import * as Y from 'yjs';
import { describe, expect, it } from 'vitest';
import { getDocsMap, getElementsMap, listElements, MAIN_PAGE } from './doc';
import { migrate, SCHEMA_VERSION } from './migrations';
import { createElements, deleteElements } from './ops';
import {
	activePage,
	addPage,
	deletePage,
	getPages,
	listAllElements,
	movePage,
	nextPageName,
	pageOfElement,
	renamePage,
	setActivePage
} from './pages';
import { samples } from './testFixtures';

describe('pages', () => {
	it('a board without a page list has one page backed by the original elements map', () => {
		const doc = new Y.Doc();
		createElements(doc, [samples.shape('a')]);
		expect(getPages(doc)).toEqual([{ id: MAIN_PAGE, name: 'Page 1' }]);
		expect(activePage(doc).id).toBe(MAIN_PAGE);
		expect(doc.getMap('elements').has('a')).toBe(true);
		migrate(doc);
		expect(doc.getMap('meta').get('schemaVersion')).toBe(SCHEMA_VERSION);
		expect(listElements(doc).map((e) => e.id)).toEqual(['a']);
	});

	it('adds, names, renames and reorders pages', () => {
		const doc = new Y.Doc();
		const p2 = addPage(doc);
		const p3 = addPage(doc, { name: '  Budget   2026 ' });
		expect(getPages(doc).map((p) => p.name)).toEqual(['Page 1', 'Page 2', 'Budget 2026']);
		const mid = addPage(doc, { afterId: MAIN_PAGE });
		expect(getPages(doc).map((p) => p.id)).toEqual([MAIN_PAGE, mid.id, p2.id, p3.id]);
		expect(mid.name).toBe('Page 4');

		renamePage(doc, p2.id, 'Plan');
		renamePage(doc, p2.id, '   '); // ignored
		expect(getPages(doc).find((p) => p.id === p2.id)?.name).toBe('Plan');
		movePage(doc, p3.id, -1);
		movePage(doc, MAIN_PAGE, -1); // already first
		expect(getPages(doc).map((p) => p.id)).toEqual([MAIN_PAGE, mid.id, p3.id, p2.id]);
		expect(nextPageName(getPages(doc))).toBe('Page 5');
	});

	it('elements belong to the active page', () => {
		const doc = new Y.Doc();
		createElements(doc, [samples.shape('a')]);
		const p2 = addPage(doc);
		setActivePage(doc, p2.id);
		expect(listElements(doc)).toEqual([]);
		createElements(doc, [samples.sticky('b'), samples.doccard('d')]);
		expect(
			listElements(doc)
				.map((e) => e.id)
				.sort()
		).toEqual(['b', 'd']);
		expect(getElementsMap(doc)).toBe(doc.getMap(`page:${p2.id}`));
		deleteElements(doc, ['b']);
		setActivePage(doc, MAIN_PAGE);
		expect(listElements(doc).map((e) => e.id)).toEqual(['a']);
		expect(
			listAllElements(doc)
				.map((e) => e.id)
				.sort()
		).toEqual(['a', 'd']);
		expect(pageOfElement(doc, 'd')).toBe(p2.id);
		expect(pageOfElement(doc, 'nope')).toBeNull();
	});

	it('deleting a page removes its elements and doc card contents; the last page stays', () => {
		const doc = new Y.Doc();
		createElements(doc, [samples.shape('a')]);
		const p2 = addPage(doc);
		setActivePage(doc, p2.id);
		createElements(doc, [samples.doccard('d')]);
		expect(getDocsMap(doc).has('d')).toBe(true);

		expect(deletePage(doc, p2.id)).toBe(true);
		expect(getPages(doc).map((p) => p.id)).toEqual([MAIN_PAGE]);
		expect(doc.getMap(`page:${p2.id}`).size).toBe(0);
		expect(getDocsMap(doc).has('d')).toBe(false);
		expect(activePage(doc).id).toBe(MAIN_PAGE); // moved off the deleted page
		expect(deletePage(doc, MAIN_PAGE)).toBe(false);
		expect(listElements(doc).map((e) => e.id)).toEqual(['a']);
	});

	it('the first page can be deleted once there is another', () => {
		const doc = new Y.Doc();
		createElements(doc, [samples.shape('a')]);
		const p2 = addPage(doc, { name: 'Keep' });
		expect(deletePage(doc, MAIN_PAGE)).toBe(true);
		expect(getPages(doc)).toEqual([{ id: p2.id, name: 'Keep' }]);
		expect(doc.getMap('elements').size).toBe(0);
		expect(activePage(doc).id).toBe(p2.id);
	});

	it('ignores a damaged stored list', () => {
		const doc = new Y.Doc();
		doc
			.getMap('meta')
			.set('pages', [{ id: 'x' }, 'junk', { id: 'y', name: 'Y' }, { id: 'y', name: 'dup' }]);
		expect(getPages(doc)).toEqual([{ id: 'y', name: 'Y' }]);
		doc.getMap('meta').set('pages', 'nope');
		expect(getPages(doc)).toEqual([{ id: MAIN_PAGE, name: 'Page 1' }]);
	});
});
