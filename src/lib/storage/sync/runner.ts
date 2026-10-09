import type { SyncEngine } from './engine';
import type { SyncStatus } from './status';

export interface SyncRunnerOptions {
	/** Wait after the last local change before syncing. */
	debounceMs?: number;
	/** Background cycle while the page is visible. */
	intervalMs?: number;
	firstBackoffMs?: number;
	maxBackoffMs?: number;
	isOnline?: () => boolean;
	isVisible?: () => boolean;
	status?: SyncStatus;
}

/**
 * Decides when the engine runs: once on start (every board), a few seconds after local changes
 * (only the changed boards), on wake-ups (online, tab visible) and every minute while visible.
 * Failures retry with exponential backoff; the boards that failed stay queued.
 */
export class SyncRunner {
	private readonly dirty = new Set<string>();
	private all = true;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private interval: ReturnType<typeof setInterval> | null = null;
	private failures = 0;
	private running: Promise<void> | null = null;
	private stopped = false;
	private readonly o: Required<Omit<SyncRunnerOptions, 'status'>> & { status?: SyncStatus };

	constructor(
		private readonly engine: SyncEngine,
		opts: SyncRunnerOptions = {}
	) {
		this.o = {
			debounceMs: 3000,
			intervalMs: 60_000,
			firstBackoffMs: 5000,
			maxBackoffMs: 5 * 60_000,
			isOnline: () => globalThis.navigator?.onLine ?? true,
			isVisible: () => globalThis.document?.visibilityState !== 'hidden',
			...opts
		};
	}

	start(): void {
		this.interval = setInterval(() => {
			if (this.o.isVisible()) this.wake();
		}, this.o.intervalMs);
		this.wake();
	}

	stop(): void {
		this.stopped = true;
		if (this.timer) clearTimeout(this.timer);
		if (this.interval) clearInterval(this.interval);
	}

	markDirty(board: string): void {
		this.dirty.add(board);
		if (this.failures === 0) this.schedule(this.o.debounceMs);
	}

	/** Run now (on start, coming online, the tab becoming visible, "Sync now"). */
	wake(): Promise<void> {
		this.failures = 0;
		return this.run();
	}

	private schedule(ms: number): void {
		if (this.stopped) return;
		if (this.timer) clearTimeout(this.timer);
		this.timer = setTimeout(() => void this.run(), ms);
	}

	private async run(): Promise<void> {
		if (this.stopped) return;
		if (this.timer) clearTimeout(this.timer);
		this.timer = null;
		if (this.running) {
			// Changes that came in during this cycle get the next one.
			await this.running;
			return this.run();
		}
		if (!this.o.isOnline()) {
			this.o.status?.set({ kind: 'offline' });
			return;
		}
		const boards = this.all ? 'all' : [...this.dirty];
		this.all = false;
		this.dirty.clear();
		this.running = this.engine.cycle(boards).then(
			() => {
				this.failures = 0;
			},
			() => {
				if (boards === 'all') this.all = true;
				else for (const b of boards) this.dirty.add(b);
				const backoff = this.o.firstBackoffMs * 2 ** this.failures;
				this.failures++;
				this.schedule(Math.min(backoff, this.o.maxBackoffMs));
			}
		);
		try {
			await this.running;
		} finally {
			this.running = null;
		}
	}
}
