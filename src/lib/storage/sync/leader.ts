export const SYNC_LOCK = 'spacy-sync';

type Locks = Pick<LockManager, 'request'>;
type Stop = () => void;

/**
 * Runs `start` in one tab per browser at a time: the tab holding the Web Lock. When that tab
 * stops or closes, the next waiting tab takes over. Without the Lock API every tab syncs, which
 * only costs duplicate uploads.
 */
export function whileLeader(
	start: () => Stop | Promise<Stop>,
	locks: Locks | undefined = globalThis.navigator?.locks
): () => void {
	let stopped = false;
	let release = () => {};
	const held = new Promise<void>((r) => (release = r));
	const lead = async () => {
		if (stopped) return;
		const stop = await start();
		await held;
		stop();
	};
	if (locks) void locks.request(SYNC_LOCK, lead);
	else void lead();
	return () => {
		stopped = true;
		release();
	};
}
