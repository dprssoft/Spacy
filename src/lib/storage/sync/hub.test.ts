import { describe, expect, it } from 'vitest';
import { requestAsset, serveAssetRequests } from './hub';

const later = <T>(ms: number, v: T) => new Promise<T>((r) => setTimeout(() => r(v), ms));

describe('requestAsset', () => {
	it('resolves true on the first responder that has it', async () => {
		const offA = serveAssetRequests(() => later(5, false));
		const offB = serveAssetRequests(() => later(20, true));
		expect(await requestAsset('x', { ackMs: 50 })).toBe(true);
		offA();
		offB();
	});

	it('resolves false only once every responder came back empty', async () => {
		const offA = serveAssetRequests(() => later(5, false));
		const offB = serveAssetRequests(() => later(80, false));
		const start = Date.now();
		expect(await requestAsset('x', { ackMs: 20 })).toBe(false);
		expect(Date.now() - start).toBeGreaterThanOrEqual(70);
		offA();
		offB();
	});

	it('resolves false when nobody answers', async () => {
		expect(await requestAsset('x', { ackMs: 10 })).toBe(false);
	});
});
