import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { whileLeader } from './leader';
import { SyncEngine, type SyncLocal, type SyncStateStore } from './engine';
import { MemoryRemoteStore } from './remote';

/** One exclusive lock per name, granted in request order (like the Web Locks API). */
class FakeLocks {
	private queue: (() => Promise<unknown>)[] = [];
	private busy = false;
	request(_name: string, cb: () => Promise<unknown>): Promise<unknown> {
		this.queue.push(cb);
		void this.next();
		return Promise.resolve();
	}
	private async next() {
		if (this.busy) return;
		const cb = this.queue.shift();
		if (!cb) return;
		this.busy = true;
		await cb();
		this.busy = false;
		void this.next();
	}
}
const asLocks = (l: FakeLocks) => l as unknown as Pick<LockManager, 'request'>;
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('whileLeader', () => {
	it('lets one tab sync at a time and hands over when it stops', async () => {
		const locks = new FakeLocks();
		const started: string[] = [];
		const stopA = whileLeader(() => {
			started.push('A');
			return () => started.push('A stopped');
		}, asLocks(locks));
		const stopB = whileLeader(() => {
			started.push('B');
			return () => {};
		}, asLocks(locks));
		await tick();
		expect(started).toEqual(['A']);
		stopA();
		await tick();
		expect(started).toEqual(['A', 'A stopped', 'B']);
		stopB();
	});

	it('runs right away without the Lock API', async () => {
		const stop = vi.fn();
		const start = vi.fn(async () => stop);
		const stopLeading = whileLeader(start, undefined);
		expect(start).toHaveBeenCalledOnce();
		stopLeading();
		await tick();
		expect(stop).toHaveBeenCalledOnce();
	});

	it('two tabs of one browser upload a change once', async () => {
		const locks = new FakeLocks();
		const store = new MemoryRemoteStore();
		// Both tabs share the browser's storage.
		const doc = new Y.Doc();
		doc.getMap('m').set('k', 'v');
		const saved = new Map<string, unknown>();
		const local: SyncLocal = {
			boardIds: async () => ['x'],
			read: async () => Y.encodeStateAsUpdate(doc),
			apply: async (_id, u) => Y.applyUpdate(doc, u)
		};
		const state: SyncStateStore = {
			get: async (k) => saved.get(k),
			set: async (k, v) => void saved.set(k, v)
		};
		const tab = () =>
			whileLeader(() => {
				void new SyncEngine({ store, local, state, device: 'browser' }).cycle();
				return () => {};
			}, asLocks(locks));
		tab();
		tab();
		await vi.waitFor(() => expect(store.calls.create).toBe(1));
		await tick();
		expect(store.calls.create).toBe(1);
	});
});
