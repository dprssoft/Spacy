import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as assetsRepo from './assetsRepo';
import * as boardsRepo from './boardsRepo';
import { getDB } from './db';
import { exportBoardPayload } from './fileFormat';
import {
	fromStored,
	isBlobRefused,
	resetBlobFallbackForTests,
	writeWithFallback,
	type StoredBytes
} from './storedBlob';
import { freshDB } from './testUtils';

const png = (content = 'pixels') => new Blob([content], { type: 'image/png' });
const refusal = () =>
	new DOMException('Error preparing Blob/File data to be stored in object store', 'UnknownError');

const hasBlob = (v: unknown) =>
	!!v && typeof v === 'object' && Object.values(v).some((x) => x instanceof Blob);

/** Makes IndexedDB refuse Blobs the way Safari's private windows do. */
function refuseBlobs() {
	for (const method of ['add', 'put'] as const) {
		const original = IDBObjectStore.prototype[method];
		vi.spyOn(IDBObjectStore.prototype, method).mockImplementation(function (
			this: IDBObjectStore,
			value: unknown,
			key?: IDBValidKey
		) {
			if (hasBlob(value)) throw refusal();
			return original.call(this, value, key);
		});
	}
}

beforeEach(async () => {
	resetBlobFallbackForTests();
	await freshDB();
});
afterEach(() => vi.restoreAllMocks());

describe('isBlobRefused', () => {
	it("recognizes Safari's errors and nothing else", () => {
		expect(isBlobRefused(refusal())).toBe(true);
		expect(isBlobRefused(new DOMException('x', 'DataCloneError'))).toBe(true);
		expect(isBlobRefused(new DOMException('Quota', 'QuotaExceededError'))).toBe(false);
		expect(isBlobRefused(new DOMException('Something else', 'UnknownError'))).toBe(false);
		expect(isBlobRefused('nope')).toBe(false);
	});
});

describe('writeWithFallback', () => {
	it('writes Blobs as they are when the browser takes them', async () => {
		const prepare = vi.fn(async (b: Blob) => b);
		expect(await writeWithFallback(png(), prepare, async () => 'ok')).toBe('ok');
		expect(prepare).not.toHaveBeenCalled();
	});

	it('retries with bytes once refused, then goes straight to bytes', async () => {
		const write = vi.fn(async (v: string) => {
			if (v === 'blob') throw refusal();
			return v;
		});
		expect(await writeWithFallback('blob', async () => 'bytes', write)).toBe('bytes');
		expect(write).toHaveBeenCalledTimes(2);
		write.mockClear();
		expect(await writeWithFallback('blob', async () => 'bytes', write)).toBe('bytes');
		expect(write).toHaveBeenCalledTimes(1);
	});

	it('passes other errors on', async () => {
		const quota = new DOMException('Full', 'QuotaExceededError');
		await expect(
			writeWithFallback(
				'blob',
				async () => 'bytes',
				async () => Promise.reject(quota)
			)
		).rejects.toBe(quota);
	});
});

describe('in a browser that refuses Blobs', () => {
	it('stores images as bytes and reads them back as Blobs', async () => {
		refuseBlobs();
		const id = await assetsRepo.put('b1', png(), { width: 64, height: 48 });
		const stored = await (await getDB()).get('assets', id);
		expect(stored?.blob).not.toBeInstanceOf(Blob);
		expect((stored?.blob as StoredBytes).type).toBe('image/png');

		const record = (await assetsRepo.get(id))!;
		expect(record.blob).toBeInstanceOf(Blob);
		expect(record.blob.type).toBe('image/png');
		expect(await record.blob.text()).toBe('pixels');
		expect(await assetsRepo.listByBoard('b1')).toHaveLength(1);
	});

	it('stores images from other devices, copies and exports them', async () => {
		refuseBlobs();
		const meta = await boardsRepo.create();
		await assetsRepo.putSynced({
			id: 'a1',
			boardId: meta.id,
			blob: png('synced'),
			mime: 'image/png',
			width: 1,
			height: 1
		});
		expect(await (await assetsRepo.get('a1'))!.blob.text()).toBe('synced');

		const ids = await assetsRepo.copyToBoard(meta.id, 'b2');
		expect(await (await assetsRepo.get(ids.get('a1')!))!.blob.text()).toBe('synced');
		const payload = await exportBoardPayload(meta.id);
		expect(payload.assets[0]?.data).toBe(btoa('synced'));
	});

	it('stores thumbnails as bytes and lists them as Blobs', async () => {
		refuseBlobs();
		const meta = await boardsRepo.create();
		await boardsRepo.setThumbnail(meta.id, png('thumb'));
		const stored = await (await getDB()).get('boards', meta.id);
		expect(stored?.thumbnail).not.toBeInstanceOf(Blob);

		const [listed] = await boardsRepo.list({ filter: 'all', sort: 'opened' });
		expect(listed!.thumbnail).toBeInstanceOf(Blob);
		expect(await listed!.thumbnail!.text()).toBe('thumb');
		expect(await (await boardsRepo.get(meta.id))!.thumbnail!.text()).toBe('thumb');
		expect((await boardsRepo.listAll())[0]!.thumbnail).toBeInstanceOf(Blob);

		// Later edits keep the stored thumbnail.
		await boardsRepo.rename(meta.id, 'Renamed');
		expect(await (await boardsRepo.get(meta.id))!.thumbnail!.text()).toBe('thumb');
		await boardsRepo.setThumbnail(meta.id, null);
		expect((await boardsRepo.get(meta.id))!.thumbnail).toBeNull();
	});
});

describe('in other browsers', () => {
	it('keeps storing Blobs, as before', async () => {
		const id = await assetsRepo.put('b1', png(), { width: 1, height: 1 });
		expect((await (await getDB()).get('assets', id))?.blob).toBeInstanceOf(Blob);
		const meta = await boardsRepo.create();
		await boardsRepo.setThumbnail(meta.id, png('thumb'));
		expect((await (await getDB()).get('boards', meta.id))?.thumbnail).toBeInstanceOf(Blob);
	});

	it('reads either form', async () => {
		expect(await fromStored(png('a')).text()).toBe('a');
		const bytes = { bytes: await png('b').arrayBuffer(), type: 'image/png' };
		expect(fromStored(bytes).type).toBe('image/png');
		expect(await fromStored(bytes).text()).toBe('b');
	});
});
