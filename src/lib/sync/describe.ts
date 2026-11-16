import type { SyncState } from '$lib/storage/sync/status';

/** `renewFailed`: a click can no longer renew the sign-in by itself. */
export function describeState(s: SyncState, renewFailed = true): string {
	switch (s.kind) {
		case 'off':
			return 'Starting…';
		case 'syncing':
			return 'Syncing…';
		case 'synced':
			return 'Synced';
		case 'offline':
			return 'Offline — changes sync when you’re back online';
		case 'signin':
			return renewFailed ? 'Sign in again to keep syncing' : 'Reconnecting on your next click';
		case 'error':
			return `Sync failed: ${s.reason}`;
	}
}
