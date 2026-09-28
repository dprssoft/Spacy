import { beforeEach, describe, expect, it } from 'vitest';
import * as assetsRepo from './assetsRepo';
import { freshDB } from './testUtils';

beforeEach(freshDB);

const png = (content = 'pixels') => new Blob([content], { type: 'image/png' });

describe('assetsRepo', () => {
	it('stores and reads back a blob with metadata', async () => {
		const id = await assetsRepo.put('b1', png(), { width: 64, height: 48 });
		const record = await assetsRepo.get(id);
		expect(record).toMatchObject({ id, boardId: 'b1', mime: 'image/png', width: 64, height: 48 });
		expect(await record?.blob.text()).toBe('pixels');
	});

	it('falls back to a generic mime type', async () => {
		const id = await assetsRepo.put('b1', new Blob(['x']), { width: 1, height: 1 });
		expect((await assetsRepo.get(id))?.mime).toBe('application/octet-stream');
	});

	it('lists and deletes by board', async () => {
		await assetsRepo.put('b1', png(), { width: 1, height: 1 });
		await assetsRepo.put('b1', png(), { width: 1, height: 1 });
		const other = await assetsRepo.put('b2', png(), { width: 1, height: 1 });
		expect(await assetsRepo.listByBoard('b1')).toHaveLength(2);
		await assetsRepo.deleteByBoard('b1');
		expect(await assetsRepo.listByBoard('b1')).toEqual([]);
		expect(await assetsRepo.get(other)).toBeDefined();
	});

	it('deletes specific assets', async () => {
		const a = await assetsRepo.put('b1', png(), { width: 1, height: 1 });
		const b = await assetsRepo.put('b1', png(), { width: 1, height: 1 });
		await assetsRepo.deleteMany([a]);
		expect(await assetsRepo.get(a)).toBeUndefined();
		expect(await assetsRepo.get(b)).toBeDefined();
	});

	it('copies assets to another board with an id map', async () => {
		const a = await assetsRepo.put('src', png('aaaa'), { width: 2, height: 3 });
		const b = await assetsRepo.put('src', png('bb'), { width: 4, height: 5 });
		const idMap = await assetsRepo.copyToBoard('src', 'dst');
		expect([...idMap.keys()].sort()).toEqual([a, b].sort());
		const copies = await assetsRepo.listByBoard('dst');
		expect(copies).toHaveLength(2);
		const copyOfA = await assetsRepo.get(idMap.get(a)!);
		expect(copyOfA).toMatchObject({ boardId: 'dst', width: 2, height: 3 });
		expect(copyOfA?.blob.size).toBe(4);
		expect(await assetsRepo.listByBoard('src')).toHaveLength(2);
	});
});
