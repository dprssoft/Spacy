import * as Y from 'yjs';
import { describe, expect, it } from 'vitest';
import { listThreads, createThread } from './comments';
import { getDocsMap, getElementsMap, getSketchesMap, listElements, MAIN_PAGE } from './doc';
import { migrate, SCHEMA_VERSION } from './migrations';
import { MIGRATION } from './origins';
import { createElements, deleteElements } from './ops';
import {
	activePage,
	addPage,
	copyName,
	deletePage,
	deletePages,
	duplicatePage,
	getPages,
	listAllElements,
	movePage,
	movePageTo,
	nextPageName,
	pageOfElement,
	pruneOrphanThreads,
	renamePage,
	setActivePage
} from './pages';
import { getOutline, setOutline } from './outline';
import { setSketchStrokes } from './ops';
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

	it('moves a page to any position', () => {
		const doc = new Y.Doc();
		const b = addPage(doc);
		const c = addPage(doc);
		const order = () => getPages(doc).map((p) => p.id);
		movePageTo(doc, MAIN_PAGE, 2);
		expect(order()).toEqual([b.id, c.id, MAIN_PAGE]);
		movePageTo(doc, MAIN_PAGE, 0);
		expect(order()).toEqual([MAIN_PAGE, b.id, c.id]);
		movePageTo(doc, c.id, 1);
		expect(order()).toEqual([MAIN_PAGE, c.id, b.id]);
		movePageTo(doc, c.id, 3); // out of range
		movePageTo(doc, c.id, -1);
		movePageTo(doc, 'nope', 0);
		expect(order()).toEqual([MAIN_PAGE, c.id, b.id]);
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

	it('deletes several pages at once, but never all of them', () => {
		const doc = new Y.Doc();
		createElements(doc, [samples.shape('a')]);
		const p2 = addPage(doc);
		const p3 = addPage(doc);
		setActivePage(doc, p2.id);
		createElements(doc, [samples.doccard('d')]);

		expect(deletePages(doc, [MAIN_PAGE, p2.id, p3.id])).toBe(false);
		expect(deletePages(doc, ['missing'])).toBe(false);
		expect(getPages(doc)).toHaveLength(3);

		expect(deletePages(doc, [MAIN_PAGE, p2.id])).toBe(true);
		expect(getPages(doc).map((p) => p.id)).toEqual([p3.id]);
		expect(doc.getMap('elements').size).toBe(0);
		expect(getDocsMap(doc).has('d')).toBe(false);
		expect(activePage(doc).id).toBe(p3.id);
	});

	it('duplicates a page after it with new ids and copies of everything on it', () => {
		const doc = new Y.Doc();
		const frame = samples.frame('f');
		const inFrame = { ...samples.shape('s'), parentId: 'f', groupId: 'g' };
		createElements(doc, [frame, inFrame, samples.doccard('d'), samples.sketch('k')]);
		getDocsMap(doc)
			.get('d')!
			.insert(0, [new Y.XmlText('hello')]);
		setSketchStrokes(doc, 'k', [{ points: [1, 2] }]);
		setOutline(doc, MAIN_PAGE, ['d']);
		createThread(doc, {
			anchor: { kind: 'element', elementId: 's' },
			page: MAIN_PAGE,
			author: 'Ann',
			text: 'hi'
		});
		const after = addPage(doc, { name: 'Last' });

		const copy = duplicatePage(doc, MAIN_PAGE)!;
		expect(getPages(doc).map((p) => p.name)).toEqual(['Page 1', 'Page 1 copy', 'Last']);
		expect(getPages(doc)[2]!.id).toBe(after.id);
		expect(activePage(doc).id).toBe(MAIN_PAGE); // the model doesn't switch pages

		setActivePage(doc, copy.id);
		const els = listElements(doc);
		expect(els).toHaveLength(4);
		const byType = (t: string) => els.find((e) => e.type === t)!;
		const [f2, s2, d2, k2] = ['frame', 'shape', 'doccard', 'sketch'].map(byType);
		expect(els.every((e) => !['f', 's', 'd', 'k'].includes(e.id))).toBe(true);
		expect(s2!.parentId).toBe(f2!.id);
		expect(s2!.groupId).not.toBe('g');
		expect(s2!.groupId).not.toBeNull();
		expect(s2!.z).toBe(inFrame.z); // same stacking order
		expect(getDocsMap(doc).get(d2!.id)!.toString()).toContain('hello');
		expect(getDocsMap(doc).get(d2!.id)).not.toBe(getDocsMap(doc).get('d'));
		expect(getSketchesMap(doc).get(k2!.id)!.toArray()).toEqual([{ points: [1, 2] }]);
		expect(getOutline(doc, copy.id)).toEqual([d2!.id]);
		const threads = listThreads(doc);
		expect(threads).toHaveLength(2);
		expect(threads.find((t) => t.page === copy.id)?.anchor).toEqual({
			kind: 'element',
			elementId: s2!.id
		});

		// The original is untouched.
		setActivePage(doc, MAIN_PAGE);
		expect(
			listElements(doc)
				.map((e) => e.id)
				.sort()
		).toEqual(['d', 'f', 'k', 's']);
		expect(duplicatePage(doc, 'missing')).toBeNull();
	});

	it('copy names fit the name limit', () => {
		expect(copyName('Plan')).toBe('Plan copy');
		const long = 'x'.repeat(40);
		expect(copyName(long)).toHaveLength(40);
		expect(copyName(long).endsWith(' copy')).toBe(true);
	});

	it('deleting pages deletes the comments on their objects, and only those', () => {
		const doc = new Y.Doc();
		createElements(doc, [samples.shape('a')]);
		const p2 = addPage(doc);
		setActivePage(doc, p2.id);
		createElements(doc, [samples.shape('b'), samples.doccard('d')]);
		const thread = (anchor: Parameters<typeof createThread>[1]['anchor'], page: string) =>
			createThread(doc, { anchor, page, author: 'Ann', text: 'hi' });
		const kept = thread({ kind: 'element', elementId: 'a' }, MAIN_PAGE);
		thread({ kind: 'element', elementId: 'b' }, p2.id);
		thread({ kind: 'text', cardId: 'd' }, p2.id);

		expect(deletePages(doc, [p2.id])).toBe(true);
		expect(listThreads(doc).map((t) => t.id)).toEqual([kept]);
	});

	it('prunes threads whose object is on no page', () => {
		const doc = new Y.Doc();
		createElements(doc, [samples.shape('a')]);
		const p2 = addPage(doc);
		setActivePage(doc, p2.id);
		createElements(doc, [samples.doccard('d')]);
		const onA = createThread(doc, {
			anchor: { kind: 'element', elementId: 'a' },
			page: MAIN_PAGE,
			author: 'Ann',
			text: 'hi'
		});
		const onD = createThread(doc, {
			anchor: { kind: 'text', cardId: 'd' },
			page: p2.id,
			author: 'Ann',
			text: 'hi'
		});
		createThread(doc, {
			anchor: { kind: 'element', elementId: 'gone' },
			page: 'old-page',
			author: 'Ann',
			text: 'orphan'
		});
		pruneOrphanThreads(doc, MIGRATION);
		expect(
			listThreads(doc)
				.map((t) => t.id)
				.sort()
		).toEqual([onA, onD].sort());
	});
});
