// Turns sync on for this browser. Nothing calls this until a remote store is configured (step 50).
import { nanoid } from 'nanoid';
import { getPref, setPref } from '$lib/shared/localPrefs';
import { SyncEngine } from './engine';
import { onDirty } from './hub';
import { idbSyncLocal, idbSyncState } from './idbLocal';
import { whileLeader } from './leader';
import type { RemoteStore } from './remote';
import { SyncRunner } from './runner';
import { SyncStatus } from './status';

export { SyncStatus } from './status';
export type { RemoteStore } from './remote';

const DEVICE_PREF = 'sync:device';

/** A random id for this browser, shared by its tabs. */
export function deviceId(): string {
	let id = getPref<string | null>(DEVICE_PREF, null);
	if (typeof id !== 'string' || !id) {
		id = nanoid(12);
		setPref(DEVICE_PREF, id);
	}
	return id;
}

export interface SyncSession {
	readonly status: SyncStatus;
	/** Runs a cycle now, if this tab is the one syncing. */
	syncNow(): Promise<void>;
	stop(): void;
}

export function startSync(store: RemoteStore): SyncSession {
	const status = new SyncStatus();
	let runner: SyncRunner | null = null;
	const stopLeading = whileLeader(() => {
		const engine = new SyncEngine({
			store,
			local: idbSyncLocal,
			state: idbSyncState,
			device: deviceId(),
			status
		});
		const r = new SyncRunner(engine, { status });
		runner = r;
		const offDirty = onDirty((board) => r.markDirty(board));
		const wake = () => void r.wake();
		const onVisible = () => {
			if (document.visibilityState === 'visible') wake();
		};
		addEventListener('online', wake);
		document.addEventListener('visibilitychange', onVisible);
		r.start();
		return () => {
			r.stop();
			runner = null;
			offDirty();
			removeEventListener('online', wake);
			document.removeEventListener('visibilitychange', onVisible);
		};
	});
	return {
		status,
		syncNow: () => runner?.wake() ?? Promise.resolve(),
		stop() {
			stopLeading();
			status.set({ kind: 'off' });
		}
	};
}
