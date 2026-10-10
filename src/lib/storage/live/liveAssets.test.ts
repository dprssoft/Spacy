import { describe, expect, it } from 'vitest';
import type { LocalAsset } from '../sync/engine';
import { FakeNetwork } from './fakeRooms';
import { LiveAssets, MAX_LIVE_ASSET_BYTES } from './liveAssets';

function peer(net: FakeNetwork, have: LocalAsset[] = []) {
	const stored = new Map(have.map((a) => [a.id, a]));
	const assets = new LiveAssets(net.join(), 'board', {
		read: async (id) => stored.get(id) ?? null,
		write: async (a) => void stored.set(a.id, a)
	});
	return { assets, stored };
}

const image = (id: string, bytes: number): LocalAsset => ({
	id,
	boardId: 'theirs',
	blob: new Blob([new Uint8Array(bytes).fill(7)], { type: 'image/png' }),
	mime: 'image/png',
	width: 20,
	height: 10
});

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('LiveAssets', () => {
	it('gets a missing image from a peer', async () => {
		const net = new FakeNetwork();
		peer(net, [image('img', 100)]);
		const b = peer(net);
		await settle();
		expect(await b.assets.request('img')).toBe(true);
		const got = b.stored.get('img');
		expect(got).toMatchObject({ boardId: 'board', mime: 'image/png', width: 20, height: 10 });
		expect(new Uint8Array(await got!.blob.arrayBuffer())).toEqual(new Uint8Array(100).fill(7));
	});

	it('stores an image once when several peers answer', async () => {
		const net = new FakeNetwork();
		peer(net, [image('img', 10)]);
		peer(net, [image('img', 10)]);
		const c = peer(net);
		let writes = 0;
		const write = c.stored.set.bind(c.stored);
		c.stored.set = (k, v) => (writes++, write(k, v));
		await settle();
		expect(await c.assets.request('img')).toBe(true);
		await settle();
		expect(writes).toBe(1);
	});

	it('does not send images over 5 MB', async () => {
		const net = new FakeNetwork();
		peer(net, [image('big', MAX_LIVE_ASSET_BYTES + 1)]);
		const b = peer(net);
		await settle();
		expect(await b.assets.request('big', 50)).toBe(false);
	});

	it('answers false at once with nobody else in the room', async () => {
		const net = new FakeNetwork();
		const a = peer(net);
		expect(await a.assets.request('img')).toBe(false);
	});
});
