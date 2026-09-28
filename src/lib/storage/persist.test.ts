import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
	vi.unstubAllGlobals();
	vi.resetModules();
});

async function load() {
	return import('./persist');
}

describe('persist', () => {
	it('requests persistence once per session', async () => {
		const persist = vi.fn().mockResolvedValue(true);
		vi.stubGlobal('navigator', {
			storage: { persisted: vi.fn().mockResolvedValue(false), persist }
		});
		const { requestPersistentStorage } = await load();
		expect(await requestPersistentStorage()).toBe(true);
		expect(await requestPersistentStorage()).toBe(true);
		expect(persist).toHaveBeenCalledTimes(1);
	});

	it('never throws and reports false when unsupported or failing', async () => {
		vi.stubGlobal('navigator', {
			storage: { persisted: vi.fn().mockRejectedValue(new Error('nope')) }
		});
		const { requestPersistentStorage, storageEstimate } = await load();
		expect(await requestPersistentStorage()).toBe(false);
		expect(await storageEstimate()).toBeNull();
	});

	it('reports usage and persistence', async () => {
		vi.stubGlobal('navigator', {
			storage: {
				estimate: vi.fn().mockResolvedValue({ usage: 1024, quota: 4096 }),
				persisted: vi.fn().mockResolvedValue(true)
			}
		});
		const { storageEstimate } = await load();
		expect(await storageEstimate()).toEqual({ usage: 1024, quota: 4096, persisted: true });
	});
});
