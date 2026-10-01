import { beforeEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { createElements } from '$lib/model/ops';
import { samples } from '$lib/model/testFixtures';
import * as assetsRepo from '$lib/storage/assetsRepo';
import { freshDB } from '$lib/storage/testUtils';
import { gcAssets } from './gcAssets';
import { capSize, fitWithin, MAX_BYTES, validateImage } from './importImages';

beforeEach(freshDB);

describe('image sizing', () => {
	it('fits within a box without upscaling', () => {
		expect(fitWithin({ w: 400, h: 200 }, { w: 100, h: 100 })).toEqual({ w: 100, h: 50 });
		expect(fitWithin({ w: 40, h: 20 }, { w: 100, h: 100 })).toEqual({ w: 40, h: 20 });
	});

	it('caps the longest side, keeping the aspect ratio', () => {
		expect(capSize({ w: 4096, h: 1024 })).toEqual({ w: 2048, h: 512 });
		expect(capSize({ w: 800, h: 600 })).toEqual({ w: 800, h: 600 });
	});

	it('accepts common image types up to 20 MB', () => {
		expect(validateImage(new Blob(['x'], { type: 'image/png' }))).toBeNull();
		expect(validateImage(new Blob(['x'], { type: 'image/svg+xml' }))).toBeNull();
		expect(validateImage(new Blob(['x'], { type: 'application/pdf' }))).toMatch(/Unsupported/);
		const big = { type: 'image/jpeg', size: MAX_BYTES + 1 } as Blob;
		expect(validateImage(big)).toMatch(/20 MB/);
	});
});

describe('gcAssets', () => {
	it('deletes old unreferenced assets and keeps referenced or recent ones', async () => {
		const used = await assetsRepo.put('b', new Blob(['a']), { width: 1, height: 1 });
		const unused = await assetsRepo.put('b', new Blob(['b']), { width: 1, height: 1 });
		const otherBoard = await assetsRepo.put('other', new Blob(['c']), { width: 1, height: 1 });
		const doc = new Y.Doc();
		createElements(doc, [{ ...samples.image('i'), assetId: used }]);

		// Just created: within the grace period, nothing is deleted.
		expect(await gcAssets('b', doc)).toEqual([]);

		const later = Date.now() + 120_000;
		expect(await gcAssets('b', doc, later)).toEqual([unused]);
		expect(await assetsRepo.get(used)).toBeDefined();
		expect(await assetsRepo.get(unused)).toBeUndefined();
		expect(await assetsRepo.get(otherBoard)).toBeDefined();
	});
});
