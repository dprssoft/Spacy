import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as boardsRepo from '$lib/storage/boardsRepo';
import { freshDB } from '$lib/storage/testUtils';
import { BoardsQuery } from './boards.svelte';

beforeEach(freshDB);

describe('BoardsQuery', () => {
	it('loads boards on start and follows filter changes', async () => {
		const a = await boardsRepo.create({ title: 'A' });
		await boardsRepo.create({ title: 'B' });
		await boardsRepo.setStarred(a.id, true);

		const query = new BoardsQuery();
		const stop = query.start();
		await vi.waitFor(() => expect(query.items).toHaveLength(2));
		expect(query.loading).toBe(false);

		query.filter = 'starred';
		await vi.waitFor(() => expect(query.items.map((b) => b.title)).toEqual(['A']));

		query.filter = 'all';
		query.query = 'b';
		await vi.waitFor(() => expect(query.items.map((b) => b.title)).toEqual(['B']));
		stop();
	});

	it('refreshes when boards change', async () => {
		const query = new BoardsQuery();
		const stop = query.start();
		await vi.waitFor(() => expect(query.loading).toBe(false));
		expect(query.items).toEqual([]);

		await boardsRepo.create({ title: 'New' });
		await vi.waitFor(() => expect(query.items.map((b) => b.title)).toEqual(['New']));

		stop();
		await boardsRepo.create({ title: 'After stop' });
		await new Promise((r) => setTimeout(r, 30));
		expect(query.items).toHaveLength(1);
	});

	it('ignores stale responses', async () => {
		await boardsRepo.create({ title: 'Only' });
		const query = new BoardsQuery();
		query.filter = 'trash';
		const stale = query.refresh();
		query.filter = 'all';
		const fresh = query.refresh();
		await Promise.all([stale, fresh]);
		expect(query.items.map((b) => b.title)).toEqual(['Only']);
	});
});
