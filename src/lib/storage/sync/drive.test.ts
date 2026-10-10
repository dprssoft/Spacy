import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { AuthRequiredError, type SyncAuth } from './auth';
import { GoogleDriveStore, MULTIPART_MAX } from './drive';
import { SyncEngine, type SyncLocal, type SyncStateStore } from './engine';
import { FakeDrive } from './fakeDrive';
import { RemoteNotFoundError } from './remote';

function setup() {
	const drive = new FakeDrive();
	const tokens: string[] = [];
	const auth: SyncAuth & { calls: { force: boolean }[] } = {
		calls: [],
		async getToken(opts) {
			this.calls.push({ force: !!opts?.force });
			tokens.push(drive.token);
			return drive.token;
		},
		async signOut() {}
	};
	const sleeps: number[] = [];
	const store = new GoogleDriveStore(auth, {
		fetch: drive.fetch,
		sleep: async (ms) => void sleeps.push(ms)
	});
	return { drive, auth, store, sleeps };
}

describe('GoogleDriveStore', () => {
	it('creates, lists, reads and removes files in the app folder', async () => {
		const { store } = setup();
		const first = await store.changes(null);
		expect(first.files).toEqual([]);
		const f = await store.create(
			'a.yjs',
			{ kind: 'update', board: 'x' },
			new Uint8Array([1, 2, 255])
		);
		expect(f).toMatchObject({ name: 'a.yjs', props: { kind: 'update', board: 'x' }, size: 3 });
		expect(await store.read(f.id)).toEqual(new Uint8Array([1, 2, 255]));

		const after = await store.changes(first.cursor);
		expect(after.files.map((x) => x.id)).toEqual([f.id]);
		await store.remove(f.id);
		const gone = await store.changes(after.cursor);
		expect(gone.removed).toEqual([f.id]);
		await expect(store.read(f.id)).rejects.toBeInstanceOf(RemoteNotFoundError);
		await store.remove(f.id); // already gone: fine
		expect((await store.changes(null)).files).toEqual([]);
	});

	it('uploads large files through a resumable session', async () => {
		const { store, drive } = setup();
		const big = new Uint8Array(MULTIPART_MAX + 10).fill(9);
		const f = await store.create('big', { kind: 'asset' }, new Blob([big], { type: 'image/png' }));
		expect(f.size).toBe(big.length);
		expect(drive.requests.filter((r) => r.startsWith('PUT'))).toHaveLength(1);
		const back = await store.read(f.id);
		expect(back.length).toBe(big.length);
		expect(back.every((b) => b === 9)).toBe(true);
	});

	it('renews a rejected token once and retries', async () => {
		const { store, drive, auth } = setup();
		const getToken = auth.getToken.bind(auth);
		let stale = true;
		// Like a real token holder: once renewed, the new token is handed out.
		auth.getToken = async (opts) => {
			const t = await getToken(opts);
			if (opts?.force) stale = false;
			return stale ? 'expired' : t;
		};
		await store.changes(null);
		expect(auth.calls.map((c) => c.force)).toEqual([false, true, false]);
		drive.token = 'new';
		await expect(
			new GoogleDriveStore(
				{ getToken: async () => 'wrong', signOut: async () => {} },
				{
					fetch: drive.fetch
				}
			).changes(null)
		).rejects.toBeInstanceOf(AuthRequiredError);
	});

	it('backs off on rate limits, then gives up', async () => {
		const { store, drive, sleeps } = setup();
		drive.failNext = {
			status: 403,
			n: 2,
			body: '{"error":{"errors":[{"reason":"userRateLimitExceeded"}]}}'
		};
		await store.changes(null);
		expect(sleeps).toHaveLength(2);
		expect(sleeps[1]!).toBeGreaterThan(sleeps[0]!);
		drive.failNext = { status: 429, n: 10 };
		await expect(store.changes(null)).rejects.toThrow('429');
		// A plain 403 (no permission) is not retried.
		drive.failNext = { status: 403, n: 1, body: 'forbidden' };
		const before = sleeps.length;
		await expect(store.changes(null)).rejects.toThrow('403');
		expect(sleeps.length).toBe(before);
	});

	it('reports the account address and deletes everything on request', async () => {
		const { store } = setup();
		expect(await store.accountEmail()).toBe('ann@example.com');
		await store.create('a', {}, new Uint8Array([1]));
		await store.create('b', {}, new Uint8Array([2]));
		await store.removeAll();
		expect((await store.changes(null)).files).toEqual([]);
	});

	it('runs the sync engine between two devices', async () => {
		const { store } = setup();
		const device = (name: string) => {
			const doc = new Y.Doc();
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
			return { doc, engine: new SyncEngine({ store, local, state, device: name }) };
		};
		const a = device('A');
		const b = device('B');
		a.doc.getMap('m').set('k', 'v');
		await a.engine.cycle();
		await b.engine.cycle();
		expect(b.doc.getMap('m').get('k')).toBe('v');
	});
});
