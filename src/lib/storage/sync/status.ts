// Sync state for the UI (step 50 shows it). Plain TS with listeners; a rune wrapper reads it.

export type SyncState =
	| { kind: 'off' }
	| { kind: 'syncing' }
	| { kind: 'synced'; at: number }
	| { kind: 'offline' }
	/** The sign-in expired; sync waits for the person (a click renews it). */
	| { kind: 'signin' }
	| { kind: 'error'; reason: string };

export type BoardSyncState =
	| { kind: 'syncing' }
	| { kind: 'synced'; at: number }
	| { kind: 'error'; reason: string }
	/** Remote changes come from a newer app version; this board's sync is paused. */
	| { kind: 'newer-schema'; version: number };

export class SyncStatus {
	overall: SyncState = { kind: 'off' };
	readonly boards = new Map<string, BoardSyncState>();
	private readonly listeners = new Set<() => void>();

	set(state: SyncState): void {
		this.overall = state;
		this.emit();
	}

	setBoard(id: string, state: BoardSyncState): void {
		this.boards.set(id, state);
		this.emit();
	}

	board(id: string): BoardSyncState | undefined {
		return this.boards.get(id);
	}

	subscribe(fn: () => void): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}

	private emit(): void {
		for (const fn of this.listeners) fn();
	}
}
