import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { LOCAL } from '$lib/model/origins';
import { FakeNetwork } from './fakeRooms';
import { PeerSync } from './peerSync';

const settle = () => new Promise((r) => setTimeout(r, 0));

function peer(net: FakeNetwork) {
	const doc = new Y.Doc();
	return { doc, sync: new PeerSync(doc, net.join()) };
}

describe('PeerSync', () => {
	it('brings a newcomer up to date and syncs edits both ways', async () => {
		const net = new FakeNetwork();
		const a = peer(net);
		a.doc.getMap('m').set('before', 1);
		const b = peer(net);
		await settle();
		expect(b.doc.getMap('m').get('before')).toBe(1);
		b.doc.getMap('m').set('fromB', 2);
		a.doc.getMap('m').set('fromA', 3);
		await settle();
		expect(a.doc.getMap('m').toJSON()).toEqual({ before: 1, fromB: 2, fromA: 3 });
		expect(b.doc.getMap('m').toJSON()).toEqual(a.doc.getMap('m').toJSON());
		expect(a.sync.peers).toBe(1);
	});

	it('merges what both had before they met', async () => {
		const net = new FakeNetwork();
		const a = new Y.Doc();
		const b = new Y.Doc();
		a.getMap('m').set('a', 1);
		b.getMap('m').set('b', 2);
		new PeerSync(a, net.join());
		new PeerSync(b, net.join());
		await settle();
		await settle();
		expect(a.getMap('m').toJSON()).toEqual({ a: 1, b: 2 });
		expect(b.getMap('m').toJSON()).toEqual({ a: 1, b: 2 });
	});

	it('keeps peer edits out of local undo', async () => {
		const net = new FakeNetwork();
		const a = peer(net);
		const b = peer(net);
		const undo = new Y.UndoManager(b.doc.getMap('m'), { trackedOrigins: new Set([LOCAL]) });
		a.doc.transact(() => a.doc.getMap('m').set('k', 'v'), LOCAL);
		await settle();
		expect(b.doc.getMap('m').get('k')).toBe('v');
		expect(undo.undoStack).toHaveLength(0);
	});

	it('shares presence and clears it when a peer leaves', async () => {
		const net = new FakeNetwork();
		const a = peer(net);
		const b = peer(net);
		b.sync.awareness.setLocalStateField('user', { name: 'Bo' });
		await settle();
		const seen = () =>
			[...a.sync.awareness.getStates().values()].map(
				(s) => (s as { user?: { name: string } }).user?.name
			);
		expect(seen()).toContain('Bo');
		const changed = vi.fn();
		a.sync.subscribe(changed);
		await b.sync.destroy();
		await settle();
		expect(seen()).not.toContain('Bo');
		expect(changed).toHaveBeenCalled();
		expect(a.sync.peers).toBe(0);
	});

	it('stops syncing after destroy', async () => {
		const net = new FakeNetwork();
		const a = peer(net);
		const b = peer(net);
		await settle();
		await b.sync.destroy();
		a.doc.getMap('m').set('late', 1);
		await settle();
		expect(b.doc.getMap('m').get('late')).toBeUndefined();
	});
});
