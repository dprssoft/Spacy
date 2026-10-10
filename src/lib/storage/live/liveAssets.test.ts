import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type { LocalAsset } from '../sync/engine';
import { LiveAssets, MAX_LIVE_ASSET_BYTES } from './liveAssets';

/** Two session docs kept in sync in memory, as a provider would. */
function link(a: Y.Doc, b: Y.Doc): void {
	a.on('update', (u: Uint8Array, origin: unknown) => origin !== b && Y.applyUpdate(b, u, a));
	b.on('update', (u: Uint8Array, origin: unknown) => origin !== a && Y.applyUpdate(a, u, b));
}

function peer(board: string, have: LocalAsset[] = []) {
	const stored = new Map(have.map((a) => [a.id, a]));
	const doc = new Y.Doc();
	const assets = new LiveAssets(doc, board, {
		read: async (id) => stored.get(id) ?? null,
		write: async (a) => void stored.set(a.id, a)
	});
	return { doc, assets, stored };
}

const image = (id: string, bytes: number): LocalAsset => ({
	id,
	boardId: 'theirs',
	blob: new Blob([new Uint8Array(bytes).fill(7)], { type: 'image/png' }),
	mime: 'image/png',
	width: 20,
	height: 10
});

describe('LiveAssets', () => {
	it('gets a missing image from a peer and cleans up', async () => {
		const a = peer('board', [image('img', 100)]);
		const b = peer('board');
		link(a.doc, b.doc);
		expect(await b.assets.request('img')).toBe(true);
		const got = b.stored.get('img');
		expect(got).toMatchObject({ boardId: 'board', mime: 'image/png', width: 20, height: 10 });
		expect(new Uint8Array(await got!.blob.arrayBuffer())).toEqual(new Uint8Array(100).fill(7));
		expect([...b.doc.getMap('wants').keys()]).toEqual([]);
		expect([...b.doc.getMap('files').keys()]).toEqual([]);
	});

	it('does not send images over 5 MB', async () => {
		const a = peer('board', [image('big', MAX_LIVE_ASSET_BYTES + 1)]);
		const b = peer('board');
		link(a.doc, b.doc);
		expect(await b.assets.request('big', 50)).toBe(false);
		expect([...b.doc.getMap('wants').keys()]).toEqual([]);
	});

	it('a peer joining later answers a request already waiting', async () => {
		const b = peer('board');
		const pending = b.assets.request('img');
		const a = peer('board', [image('img', 10)]);
		Y.applyUpdate(a.doc, Y.encodeStateAsUpdate(b.doc));
		link(a.doc, b.doc);
		// The existing want reaches A through a fresh sync.
		Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));
		expect(await pending).toBe(true);
	});
});
