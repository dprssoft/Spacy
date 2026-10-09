import { newId } from '$lib/model/ids';
import { notifyBoardsChanged, notifyBoardsChangedSoon } from './channels';
import { getDB } from './db';
import type { BoardFilter, BoardMeta, BoardSort } from './types';

export const DEFAULT_TITLE = 'Untitled board';
/** Title of a board from another device whose content hasn't arrived yet. */
export const SYNCING_TITLE = 'Syncing…';
const DAY = 24 * 60 * 60 * 1000;

export async function get(id: string): Promise<BoardMeta | undefined> {
	return (await getDB()).get('boards', id);
}

const sorters: Record<BoardSort, (a: BoardMeta, b: BoardMeta) => number> = {
	opened: (a, b) => b.openedAt - a.openedAt,
	updated: (a, b) => b.updatedAt - a.updatedAt,
	created: (a, b) => b.createdAt - a.createdAt,
	title: (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
};

const filters: Record<BoardFilter, (b: BoardMeta) => boolean> = {
	recent: (b) => b.deletedAt === null,
	all: (b) => b.deletedAt === null,
	starred: (b) => b.starred && b.deletedAt === null,
	trash: (b) => b.deletedAt !== null
};

export async function list(opts: {
	filter: BoardFilter;
	sort: BoardSort;
	query?: string;
}): Promise<BoardMeta[]> {
	const q = opts.query?.trim().toLowerCase() ?? '';
	const sort = opts.filter === 'recent' ? 'opened' : opts.sort;
	return (await (await getDB()).getAll('boards'))
		.filter(filters[opts.filter])
		.filter((b) => !q || b.title.toLowerCase().includes(q))
		.sort(sorters[sort]);
}

export async function create(
	init: { title?: string; createdAt?: number } = {}
): Promise<BoardMeta> {
	const now = Date.now();
	const meta: BoardMeta = {
		id: newId(),
		title: init.title?.trim() || DEFAULT_TITLE,
		createdAt: init.createdAt ?? now,
		updatedAt: now,
		openedAt: now,
		starred: false,
		deletedAt: null,
		thumbnail: null,
		viewport: null
	};
	await (await getDB()).add('boards', meta);
	notifyBoardsChanged();
	return meta;
}

/** Read-modify-write of one board in a single transaction. Missing ids are a silent no-op. */
async function patch(
	id: string,
	change: Partial<Omit<BoardMeta, 'id'>>,
	notify: () => void = notifyBoardsChanged
): Promise<void> {
	const tx = (await getDB()).transaction('boards', 'readwrite');
	const current = await tx.store.get(id);
	if (current) await tx.store.put({ ...current, ...change });
	await tx.done;
	if (current) notify();
}

export async function rename(id: string, title: string): Promise<void> {
	const t = title.trim();
	if (t) await patch(id, { title: t });
}

export const setStarred = (id: string, starred: boolean) => patch(id, { starred });
export const touchOpened = (id: string) => patch(id, { openedAt: Date.now() });
export const trash = (id: string) => patch(id, { deletedAt: Date.now() });
export const restore = (id: string) => patch(id, { deletedAt: null });

export const touchUpdated = (id: string) =>
	patch(id, { updatedAt: Date.now() }, notifyBoardsChangedSoon);
export const setThumbnail = (id: string, thumbnail: Blob | null) =>
	patch(id, { thumbnail }, notifyBoardsChangedSoon);
export const setViewport = (id: string, viewport: BoardMeta['viewport']) =>
	patch(id, { viewport }, notifyBoardsChangedSoon);

/** Lists a board that came from another device (sync), keeping its id and creation time. */
export async function insert(
	id: string,
	init: Pick<BoardMeta, 'title' | 'createdAt' | 'starred' | 'deletedAt'>
): Promise<void> {
	const meta: BoardMeta = {
		id,
		...init,
		updatedAt: Date.now(),
		openedAt: 0,
		thumbnail: null,
		viewport: null
	};
	await (await getDB()).put('boards', meta);
	notifyBoardsChanged();
}

/** Applies starred/trash changes that came from another device. */
export const setSynced = (id: string, change: Partial<Pick<BoardMeta, 'starred' | 'deletedAt'>>) =>
	patch(id, change);

/** Removes the board's metadata and assets only. Use `destroyBoard` (boardLifecycle) to delete a board. */
export async function destroy(id: string): Promise<void> {
	const tx = (await getDB()).transaction(['boards', 'assets'], 'readwrite');
	const assets = tx.objectStore('assets');
	const assetKeys = await assets.index('boardId').getAllKeys(id);
	await Promise.all([
		tx.objectStore('boards').delete(id),
		...assetKeys.map((k) => assets.delete(k))
	]);
	await tx.done;
	notifyBoardsChanged();
}

/** Ids of trashed boards deleted more than `days` ago. */
export async function expiredTrash(now = Date.now(), days = 30): Promise<string[]> {
	const boards = await (await getDB()).getAll('boards');
	return boards
		.filter((b) => b.deletedAt !== null && now - b.deletedAt > days * DAY)
		.map((b) => b.id);
}
