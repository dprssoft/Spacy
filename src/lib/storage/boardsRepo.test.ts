import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as assetsRepo from './assetsRepo';
import * as boardsRepo from './boardsRepo';
import { onBoardsChanged } from './channels';
import { freshDB } from './testUtils';

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date('2026-01-01T12:00:00Z').getTime();

// Only fake the clock: fake-indexeddb schedules its work with real timers.
beforeEach(async () => {
	await freshDB();
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

async function createAt(t: number, title?: string) {
	vi.setSystemTime(t);
	return boardsRepo.create({ title });
}

describe('boardsRepo', () => {
	it('creates boards with defaults', async () => {
		const meta = await boardsRepo.create();
		expect(meta).toMatchObject({
			title: 'Untitled board',
			createdAt: T0,
			updatedAt: T0,
			openedAt: T0,
			starred: false,
			deletedAt: null,
			thumbnail: null,
			viewport: null
		});
		expect(await boardsRepo.get(meta.id)).toEqual(meta);
		expect((await boardsRepo.create({ title: '  Plan  ' })).title).toBe('Plan');
	});

	it('renames with trimming and ignores empty titles', async () => {
		const { id } = await boardsRepo.create();
		await boardsRepo.rename(id, '  Roadmap ');
		expect((await boardsRepo.get(id))?.title).toBe('Roadmap');
		await boardsRepo.rename(id, '   ');
		expect((await boardsRepo.get(id))?.title).toBe('Roadmap');
	});

	it('filters by view', async () => {
		const a = await boardsRepo.create({ title: 'A' });
		const b = await boardsRepo.create({ title: 'B' });
		const c = await boardsRepo.create({ title: 'C' });
		await boardsRepo.setStarred(a.id, true);
		await boardsRepo.setStarred(c.id, true);
		await boardsRepo.trash(c.id);
		const ids = async (filter: 'recent' | 'starred' | 'all' | 'trash') =>
			(await boardsRepo.list({ filter, sort: 'title' })).map((m) => m.id);
		expect(await ids('all')).toEqual([a.id, b.id]);
		expect(await ids('starred')).toEqual([a.id]);
		expect(await ids('trash')).toEqual([c.id]);
		expect((await ids('recent')).sort()).toEqual([a.id, b.id].sort());
	});

	it('sorts by each key; recent always sorts by last opened', async () => {
		const a = await createAt(T0, 'banana');
		const b = await createAt(T0 + 1000, 'Apple');
		const c = await createAt(T0 + 2000, 'cherry');
		vi.setSystemTime(T0 + 5000);
		await boardsRepo.touchUpdated(a.id);
		vi.setSystemTime(T0 + 6000);
		await boardsRepo.touchOpened(b.id);
		const ids = async (sort: 'opened' | 'updated' | 'created' | 'title', filter = 'all' as const) =>
			(await boardsRepo.list({ filter, sort })).map((m) => m.id);
		expect(await ids('title')).toEqual([b.id, a.id, c.id]);
		expect(await ids('created')).toEqual([c.id, b.id, a.id]);
		expect(await ids('updated')).toEqual([a.id, c.id, b.id]);
		expect(await ids('opened')).toEqual([b.id, c.id, a.id]);
		expect((await boardsRepo.list({ filter: 'recent', sort: 'title' })).map((m) => m.id)).toEqual([
			b.id,
			c.id,
			a.id
		]);
	});

	it('searches titles case-insensitively', async () => {
		await boardsRepo.create({ title: 'Product Roadmap' });
		await boardsRepo.create({ title: 'Retro' });
		const found = await boardsRepo.list({ filter: 'all', sort: 'title', query: '  ROAD ' });
		expect(found.map((m) => m.title)).toEqual(['Product Roadmap']);
	});

	it('trashes and restores', async () => {
		const { id } = await boardsRepo.create();
		await boardsRepo.trash(id);
		expect((await boardsRepo.get(id))?.deletedAt).toBe(T0);
		await boardsRepo.restore(id);
		expect((await boardsRepo.get(id))?.deletedAt).toBeNull();
	});

	it('stores thumbnails and viewports', async () => {
		const { id } = await boardsRepo.create();
		await boardsRepo.setThumbnail(id, new Blob(['png'], { type: 'image/png' }));
		await boardsRepo.setViewport(id, { x: 1, y: 2, zoom: 1.5 });
		const meta = await boardsRepo.get(id);
		expect(meta?.thumbnail?.size).toBe(3);
		expect(meta?.viewport).toEqual({ x: 1, y: 2, zoom: 1.5 });
	});

	it('ignores mutations of missing boards', async () => {
		await expect(boardsRepo.rename('nope', 'X')).resolves.toBeUndefined();
		expect(await boardsRepo.get('nope')).toBeUndefined();
	});

	it('destroys a board with its assets', async () => {
		const keep = await boardsRepo.create();
		const gone = await boardsRepo.create();
		await assetsRepo.put(gone.id, new Blob(['a']), { width: 1, height: 1 });
		const kept = await assetsRepo.put(keep.id, new Blob(['b']), { width: 1, height: 1 });
		await boardsRepo.destroy(gone.id);
		expect(await boardsRepo.get(gone.id)).toBeUndefined();
		expect(await assetsRepo.listByBoard(gone.id)).toEqual([]);
		expect(await assetsRepo.get(kept)).toBeDefined();
	});

	it('lists trash older than 30 days as expired', async () => {
		const old = await boardsRepo.create();
		const recent = await boardsRepo.create();
		await boardsRepo.create();
		await boardsRepo.trash(old.id);
		vi.setSystemTime(T0 + 20 * DAY);
		await boardsRepo.trash(recent.id);
		expect(await boardsRepo.expiredTrash(T0 + 31 * DAY)).toEqual([old.id]);
		expect(await boardsRepo.expiredTrash(T0 + 51 * DAY)).toHaveLength(2);
	});
});

describe('change notifications', () => {
	it('notifies immediately for user-visible changes', async () => {
		const cb = vi.fn();
		const off = onBoardsChanged(cb);
		const { id } = await boardsRepo.create();
		await boardsRepo.rename(id, 'X');
		await boardsRepo.setStarred(id, true);
		await boardsRepo.trash(id);
		await boardsRepo.restore(id);
		await boardsRepo.touchOpened(id);
		await boardsRepo.destroy(id);
		expect(cb).toHaveBeenCalledTimes(7);
		off();
		await boardsRepo.create();
		expect(cb).toHaveBeenCalledTimes(7);
	});

	it('coalesces background changes into one delayed notice', async () => {
		// Fresh modules: earlier tests may have left a real coalescing timer pending.
		vi.resetModules();
		const repo = await import('./boardsRepo');
		const channels = await import('./channels');
		const db = await import('./db');
		const { id } = await repo.create();
		vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
		const cb = vi.fn();
		const off = channels.onBoardsChanged(cb);
		await repo.touchUpdated(id);
		await repo.setViewport(id, { x: 0, y: 0, zoom: 1 });
		await repo.setThumbnail(id, null);
		expect(cb).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1000);
		expect(cb).toHaveBeenCalledTimes(1);
		off();
		await db.resetDBForTests();
	});
});
