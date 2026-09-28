import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { REMOTE_TAB } from '$lib/model/origins';
import { createTabSync } from './tabSync';

const settle = () => new Promise((r) => setTimeout(r, 30));
let n = 0;
const channelName = () => `test-tab-sync-${++n}`;

describe('createTabSync', () => {
	it('syncs edits both ways between two docs on the same channel', async () => {
		const name = channelName();
		const a = new Y.Doc();
		const b = new Y.Doc();
		const stopA = createTabSync(a, name);
		const stopB = createTabSync(b, name);
		a.getMap('m').set('from', 'a');
		b.getMap('m').set('other', 'b');
		await settle();
		expect(a.getMap('m').toJSON()).toEqual({ from: 'a', other: 'b' });
		expect(b.getMap('m').toJSON()).toEqual({ from: 'a', other: 'b' });
		stopA();
		stopB();
	});

	it('brings a late joiner up to date, and the joiner shares its own state', async () => {
		const name = channelName();
		const a = new Y.Doc();
		a.getMap('m').set('early', 1);
		const stopA = createTabSync(a, name);
		await settle();

		const b = new Y.Doc();
		b.getMap('m').set('offline', 2); // edits made before joining
		const stopB = createTabSync(b, name);
		await settle();
		expect(b.getMap('m').toJSON()).toEqual({ early: 1, offline: 2 });
		expect(a.getMap('m').toJSON()).toEqual({ early: 1, offline: 2 });
		stopA();
		stopB();
	});

	it('applies remote updates with the REMOTE_TAB origin and does not echo them', async () => {
		const name = channelName();
		const a = new Y.Doc();
		const b = new Y.Doc();
		const stopA = createTabSync(a, name);
		const stopB = createTabSync(b, name);
		await settle();
		const origins: unknown[] = [];
		b.on('afterTransaction', (tr: Y.Transaction) => origins.push(tr.origin));
		let aUpdates = 0;
		a.on('update', () => aUpdates++);
		a.getMap('m').set('x', 1);
		await settle();
		expect(origins).toEqual([REMOTE_TAB]);
		expect(aUpdates).toBe(1); // b did not send the change back
		stopA();
		stopB();
	});

	it('stops syncing after cleanup', async () => {
		const name = channelName();
		const a = new Y.Doc();
		const b = new Y.Doc();
		const stopA = createTabSync(a, name);
		const stopB = createTabSync(b, name);
		stopB();
		a.getMap('m').set('x', 1);
		await settle();
		expect(b.getMap('m').has('x')).toBe(false);
		stopA();
	});
});
