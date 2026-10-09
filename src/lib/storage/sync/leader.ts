export const SYNC_LOCK = 'spacy-sync';

type Locks = Pick<LockManager, 'request'>;

/**
 * Runs `start` in one tab per browser at a time: the tab holding the Web Lock. When that tab
 * stops or closes, the next waiting tab takes over. Without the Lock API every tab syncs, which
 * only costs duplicate uploads.
 */
export function whileLeader(
	start: () => () => void,
	locks: Locks | undefined = globalThis.navigator?.locks
): () => void {
	if (!locks) return start();
	let stopped = false;
	let release = () => {};
	const held = new Promise<void>((r) => (release = r));
	void locks.request(SYNC_LOCK, async () => {
		if (stopped) return;
		const stop = start();
		await held;
		stop();
	});
	return () => {
		stopped = true;
		release();
	};
}
