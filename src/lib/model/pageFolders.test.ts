import * as Y from 'yjs';
import { describe, expect, it } from 'vitest';
import { MAIN_PAGE } from './doc';
import {
	addPage,
	createFolder,
	deletePages,
	duplicatePage,
	getPageFolders,
	getPages,
	moveFolder,
	movePage,
	moveToFolder,
	pageUnits,
	placePages,
	renameFolder,
	setFolderCollapsed,
	ungroupFolder
} from './pages';

/** A board with pages A…E (A is the main page). */
function board() {
	const doc = new Y.Doc();
	addPage(doc, { name: 'B' });
	addPage(doc, { name: 'C' });
	addPage(doc, { name: 'D' });
	addPage(doc, { name: 'E' });
	const id = (name: string) =>
		name === 'A' ? MAIN_PAGE : getPages(doc).find((p) => p.name === name)!.id;
	/** The strip as text: pages by name, folders as `Name[pages]`. */
	const strip = () =>
		pageUnits(getPages(doc), getPageFolders(doc))
			.map((u) =>
				u.kind === 'page'
					? u.page.id === MAIN_PAGE
						? 'A'
						: u.page.name
					: `${u.folder.name}[${u.pages.map((p) => p.name).join(' ')}]`
			)
			.join(' ')
			.replace('Page 1', 'A');
	return { doc, id, strip };
}

describe('page folders', () => {
	it('groups pages into a folder where the first of them was', () => {
		const { doc, id, strip } = board();
		const f = createFolder(doc, [id('D'), id('B')])!;
		expect(f.name).toBe('Folder 1');
		expect(strip()).toBe('A Folder 1[B D] C E');
		expect(getPages(doc).filter((p) => p.folder === f.id)).toHaveLength(2);
		expect(createFolder(doc, ['nope'])).toBeNull();
	});

	it('a new folder made inside another takes that folder’s place', () => {
		const { doc, id, strip } = board();
		createFolder(doc, [id('B'), id('C'), id('D')], 'Outer');
		createFolder(doc, [id('C')], 'Inner');
		expect(strip()).toBe('A Inner[C] Outer[B D] E');
	});

	it('renames, collapses and ungroups', () => {
		const { doc, id, strip } = board();
		const f = createFolder(doc, [id('B'), id('C')])!;
		renameFolder(doc, f.id, '  Design  ');
		renameFolder(doc, f.id, '   ');
		setFolderCollapsed(doc, f.id, true);
		expect(getPageFolders(doc)).toEqual([{ id: f.id, name: 'Design', collapsed: true }]);
		ungroupFolder(doc, f.id);
		expect(strip()).toBe('A B C D E');
		expect(getPageFolders(doc)).toEqual([]);
		expect(getPages(doc).some((p) => p.folder)).toBe(false);
	});

	it('pages added or duplicated next to a folder page go into the folder', () => {
		const { doc, id, strip } = board();
		createFolder(doc, [id('B'), id('C')], 'F');
		addPage(doc, { afterId: id('C'), name: 'X' });
		duplicatePage(doc, id('B'));
		addPage(doc, { name: 'Y' });
		expect(strip()).toBe('A F[B B copy C X] D E Y');
	});

	it('a folder whose pages are all deleted or moved out goes away', () => {
		const { doc, id, strip } = board();
		const f = createFolder(doc, [id('B'), id('C')], 'F')!;
		createFolder(doc, [id('E')], 'G');
		deletePages(doc, [id('E')]);
		moveToFolder(doc, [id('B'), id('C')], null);
		expect(strip()).toBe('A B C D');
		expect(getPageFolders(doc)).toEqual([]);
		expect(doc.getMap('meta').get('pageFolders')).toEqual([]);
		setFolderCollapsed(doc, f.id, true); // gone: nothing happens
		expect(getPageFolders(doc)).toEqual([]);
	});

	it('moves pages into and out of folders', () => {
		const { doc, id, strip } = board();
		const f = createFolder(doc, [id('B')], 'F')!;
		moveToFolder(doc, [id('A'), id('E')], f.id);
		expect(strip()).toBe('F[B A E] C D');
		moveToFolder(doc, [id('A')], null);
		expect(strip()).toBe('F[B E] A C D');
		moveToFolder(doc, [id('B'), id('E')], null);
		expect(strip()).toBe('B E A C D');
	});

	it('places dragged pages inside or outside folders', () => {
		const { doc, id, strip } = board();
		const f = createFolder(doc, [id('B'), id('C')], 'F')!;
		placePages(doc, [id('E')], { before: id('C'), folder: f.id });
		expect(strip()).toBe('A F[B E C] D');
		placePages(doc, [id('B')], { before: id('A'), folder: null });
		expect(strip()).toBe('B A F[E C] D');
		// A top-level page dropped "before" a page inside a folder goes before the whole folder.
		placePages(doc, [id('D')], { before: id('C'), folder: null });
		expect(strip()).toBe('B A D F[E C]');
		placePages(doc, [id('A')], { before: null, folder: f.id });
		expect(strip()).toBe('B D F[E C A]');
		placePages(doc, [id('A')], { before: null, folder: 'unknown' });
		expect(strip()).toBe('B D F[E C] A');
	});

	it('moves a folder with its pages', () => {
		const { doc, id, strip } = board();
		const f = createFolder(doc, [id('B'), id('C')], 'F')!;
		createFolder(doc, [id('E')], 'G');
		moveFolder(doc, f.id, null);
		expect(strip()).toBe('A D G[E] F[B C]');
		moveFolder(doc, f.id, id('A'));
		expect(strip()).toBe('F[B C] A D G[E]');
		moveFolder(doc, f.id, id('E')); // before G
		expect(strip()).toBe('A D F[B C] G[E]');
		moveFolder(doc, f.id, id('B')); // into itself: nothing
		expect(strip()).toBe('A D F[B C] G[E]');
	});

	it('Ctrl+Shift+Arrow moves inside a folder, out at its ends, and over whole folders', () => {
		const { doc, id, strip } = board();
		createFolder(doc, [id('B'), id('C')], 'F');
		movePage(doc, id('A'), 1);
		expect(strip()).toBe('F[B C] A D E');
		movePage(doc, id('A'), -1);
		expect(strip()).toBe('A F[B C] D E');
		movePage(doc, id('B'), 1);
		expect(strip()).toBe('A F[C B] D E');
		movePage(doc, id('B'), 1);
		expect(strip()).toBe('A F[C] B D E');
		movePage(doc, id('C'), -1);
		expect(strip()).toBe('A C B D E');
	});

	it('regroups split folders and ignores damaged folder data', () => {
		const doc = new Y.Doc();
		const meta = doc.getMap('meta');
		meta.set('pageFolders', [
			{ id: 'f', name: 'F' },
			'junk',
			{ id: 'f', name: 'dup' },
			{ id: 'g', name: 7 }
		]);
		meta.set('pages', [
			{ id: 'a', name: 'A', folder: 'f' },
			{ id: 'b', name: 'B' },
			{ id: 'c', name: 'C', folder: 'f' },
			{ id: 'd', name: 'D', folder: 'g' }
		]);
		expect(getPages(doc)).toEqual([
			{ id: 'a', name: 'A', folder: 'f' },
			{ id: 'c', name: 'C', folder: 'f' },
			{ id: 'b', name: 'B' },
			{ id: 'd', name: 'D' }
		]);
		expect(getPageFolders(doc)).toEqual([{ id: 'f', name: 'F', collapsed: false }]);
	});
});
