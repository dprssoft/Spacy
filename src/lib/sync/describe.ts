import type { SyncState } from '$lib/storage/sync/status';

export function describeState(s: SyncState): string {
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
			return 'Sign in again to keep syncing';
		case 'error':
			return `Sync failed: ${s.reason}`;
	}
}
