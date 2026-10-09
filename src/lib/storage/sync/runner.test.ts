import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncEngine } from './engine';
import { SyncRunner } from './runner';
import { SyncStatus } from './status';

function fakeEngine(fail: () => boolean = () => false) {
	const calls: (string[] | 'all')[] = [];
	const engine = {
		cycle: vi.fn(async (boards: Iterable<string> | 'all') => {
			calls.push(boards === 'all' ? 'all' : [...boards]);
			if (fail()) throw new Error('down');
		})
	};
	return { engine: engine as unknown as SyncEngine, calls };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('SyncRunner', () => {
	it('syncs every board on start, then changed boards after a pause', async () => {
		const { engine, calls } = fakeEngine();
		const runner = new SyncRunner(engine, { isVisible: () => true, isOnline: () => true });
		runner.start();
		await vi.advanceTimersByTimeAsync(0);
		expect(calls).toEqual(['all']);
		runner.markDirty('a');
		await vi.advanceTimersByTimeAsync(2000);
		runner.markDirty('b');
		await vi.advanceTimersByTimeAsync(2999);
		expect(calls).toHaveLength(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(calls[1]).toEqual(['a', 'b']);
		runner.stop();
	});

	it('runs every minute while visible', async () => {
		const { engine, calls } = fakeEngine();
		let visible = true;
		const runner = new SyncRunner(engine, { isVisible: () => visible, isOnline: () => true });
		runner.start();
		await vi.advanceTimersByTimeAsync(60_000);
		expect(calls).toHaveLength(2);
		visible = false;
		await vi.advanceTimersByTimeAsync(60_000);
		expect(calls).toHaveLength(2);
		runner.stop();
	});

	it('backs off after failures and keeps the failed boards', async () => {
		let failing = true;
		const { engine, calls } = fakeEngine(() => failing);
		const runner = new SyncRunner(engine, {
			isVisible: () => false,
			isOnline: () => true,
			firstBackoffMs: 1000,
			maxBackoffMs: 3000
		});
		runner.start();
		await vi.advanceTimersByTimeAsync(0);
		await vi.advanceTimersByTimeAsync(1000); // retry 1 after 1 s
		await vi.advanceTimersByTimeAsync(2000); // retry 2 after 2 s
		await vi.advanceTimersByTimeAsync(2999); // retry 3 waits the 3 s cap
		expect(calls).toHaveLength(3);
		failing = false;
		await vi.advanceTimersByTimeAsync(1);
		expect(calls).toEqual(['all', 'all', 'all', 'all']);
		runner.stop();
	});

	it('reports offline and waits for a wake-up', async () => {
		const { engine, calls } = fakeEngine();
		let online = false;
		const status = new SyncStatus();
		const runner = new SyncRunner(engine, {
			isOnline: () => online,
			isVisible: () => false,
			status
		});
		runner.start();
		await vi.advanceTimersByTimeAsync(0);
		expect(status.overall.kind).toBe('offline');
		expect(calls).toHaveLength(0);
		online = true;
		await runner.wake();
		expect(calls).toEqual(['all']);
		runner.stop();
	});
});
