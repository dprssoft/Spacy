// Google Drive sync for the whole app: the connection (remembered per browser), sign-in, and the
// state every tab shows. The sync code itself loads only once sync is connected.
import { toast } from 'svelte-sonner';
import { getPref, removePref, setPref } from '$lib/shared/localPrefs';
import type { SyncState } from '$lib/storage/sync/status';
import { driveSyncAvailable, GOOGLE_CLIENT_ID } from './config';

type Modules = {
	sync: typeof import('$lib/storage/sync/index');
	drive: typeof import('$lib/storage/sync/drive');
	gis: typeof import('./gisAuth');
	hub: typeof import('$lib/storage/sync/hub');
};
type Started = {
	session: import('$lib/storage/sync/index').SyncSession;
	store: import('$lib/storage/sync/drive').GoogleDriveStore;
};

const CONNECTED = 'sync:drive';
const EMAIL = 'sync:email';
type ConnMessage = { type: 'connected' | 'disconnected' };

class DriveSync {
	readonly available = driveSyncAvailable();
	connected = $state(false);
	email = $state<string | null>(null);
	state = $state<SyncState>({ kind: 'off' });
	busy = $state(false);
	#modules: Promise<Modules> | null = null;
	#auth: import('./gisAuth').GisAuth | null = null;
	#started: Started | null = null;
	#offStatus: (() => void) | null = null;
	#channel: BroadcastChannel | null = null;

	/** Once per page (root layout). */
	init(): () => void {
		if (!this.available) return () => {};
		this.connected = getPref<boolean>(CONNECTED, false) === true;
		this.email = getPref<string | null>(EMAIL, null);
		if (typeof BroadcastChannel === 'function') {
			this.#channel = new BroadcastChannel('spacy-sync-connection');
			// Connecting or disconnecting in one tab applies to every tab.
			this.#channel.onmessage = (e: MessageEvent<ConnMessage>) => {
				if (e.data?.type === 'connected') {
					this.connected = true;
					this.email = getPref<string | null>(EMAIL, null);
					void this.#start();
				} else if (e.data?.type === 'disconnected') {
					this.connected = false;
					this.email = null;
					this.#stop();
				}
			};
		}
		if (this.connected) void this.#start();
		return () => {
			this.#channel?.close();
			this.#stop();
		};
	}

	/** Loads the sync code and Google's script, so a click can open the sign-in popup at once. */
	async prepare(): Promise<void> {
		const m = await this.#load();
		this.#auth ??= new m.gis.GisAuth(
			GOOGLE_CLIENT_ID,
			() => void this.syncNow(),
			() => this.email
		);
		await this.#auth.prepare();
	}

	/** "Connect Google Drive" (from a click). */
	async connect(): Promise<void> {
		this.busy = true;
		try {
			await this.prepare();
			await this.#auth!.signIn('consent');
			this.connected = true;
			setPref(CONNECTED, true);
			const started = await this.#start();
			this.email = (await started?.store.accountEmail()) ?? null;
			setPref(EMAIL, this.email);
			this.#channel?.postMessage({ type: 'connected' } satisfies ConnMessage);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Couldn’t connect Google Drive');
		} finally {
			this.busy = false;
		}
	}

	/** "Sign in again" (from a click). */
	async resume(): Promise<void> {
		try {
			await this.prepare();
			await this.#auth!.signIn('');
			await this.syncNow();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Couldn’t sign in');
		}
	}

	async syncNow(): Promise<void> {
		await this.#started?.session.syncNow();
	}

	/** Boards stay in this browser; `deleteRemote` also deletes Spacy's copy in Drive. */
	async disconnect(deleteRemote: boolean): Promise<void> {
		this.busy = true;
		try {
			if (deleteRemote) await this.#started?.store.removeAll();
			await this.#auth?.signOut();
		} catch (err) {
			toast.error(
				deleteRemote ? 'Couldn’t delete the copy in Google Drive' : 'Couldn’t sign out of Google'
			);
			console.error(err);
		} finally {
			this.busy = false;
		}
		this.#stop();
		this.connected = false;
		this.email = null;
		removePref(CONNECTED);
		removePref(EMAIL);
		this.#channel?.postMessage({ type: 'disconnected' } satisfies ConnMessage);
	}

	#load(): Promise<Modules> {
		this.#modules ??= Promise.all([
			import('$lib/storage/sync/index'),
			import('$lib/storage/sync/drive'),
			import('./gisAuth'),
			import('$lib/storage/sync/hub')
		]).then(([sync, drive, gis, hub]) => ({ sync, drive, gis, hub }));
		return this.#modules;
	}

	async #start(): Promise<Started | null> {
		if (this.#started) return this.#started;
		const m = await this.#load();
		if (this.#started || !this.connected) return this.#started;
		this.#auth ??= new m.gis.GisAuth(
			GOOGLE_CLIENT_ID,
			() => void this.syncNow(),
			() => this.email
		);
		// Google's script loads now, so a later click can renew the sign-in.
		void this.#auth.prepare().catch(() => {});
		const store = new m.drive.GoogleDriveStore(this.#auth);
		this.#started = { session: m.sync.startSync(store), store };
		this.#offStatus = m.hub.onStatus((s) => {
			this.state = s;
			// Whichever tab the person is using renews the sign-in for the one that syncs.
			if (s.kind === 'signin') this.#auth?.renewOnNextGesture();
		});
		return this.#started;
	}

	#stop(): void {
		this.#offStatus?.();
		this.#offStatus = null;
		this.#started?.session.stop();
		this.#started = null;
		this.state = { kind: 'off' };
	}
}

export const driveSync = new DriveSync();
