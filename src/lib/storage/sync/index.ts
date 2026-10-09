// Turns sync on for this browser. Nothing calls this until a remote store is configured (step 50).
import { nanoid } from 'nanoid';
import { getPref, setPref } from '$lib/shared/localPrefs';
import { SyncEngine } from './engine';
import { onDirty } from './hub';
import { onBoardsChanged } from '../channels';
import { createIdbSyncLocal, idbSyncState } from './idbLocal';
import { LIBRARY_ID, openLibrary } from './library';
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
	const stopLeading = whileLeader(async () => {
		const library = await openLibrary();
		const engine = new SyncEngine({
			store,
			local: createIdbSyncLocal(library.doc),
			state: idbSyncState,
			device: deviceId(),
			status
		});
		const r = new SyncRunner(engine, { status });
		runner = r;
		const offDirty = onDirty((board) => r.markDirty(board));
		// The list changed here (or in another tab): the library reconciles in the next cycle.
		const offBoards = onBoardsChanged(() => r.markDirty(LIBRARY_ID));
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
			offBoards();
			void library.close();
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
