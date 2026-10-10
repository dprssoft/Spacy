// Public Nostr relays reject messages stamped more than a few minutes from their own time, so a
// computer whose clock is off (common on PCs that dual-boot Windows) can't find anyone to share
// with. The web server's Date header tells how far off this clock is.

/** Milliseconds this clock is ahead (+) or behind (−) the server's; null if unknown. */
export async function clockSkewMs(
	fetchFn: typeof fetch = fetch,
	now: () => number = Date.now,
	url = '/'
): Promise<number | null> {
	try {
		const before = now();
		const r = await fetchFn(url, { method: 'HEAD', cache: 'no-store' });
		const after = now();
		const date = Date.parse(r.headers.get('date') ?? '');
		if (Number.isNaN(date)) return null;
		// The header has whole seconds; compare with the middle of the request.
		return Math.round((before + after) / 2 - date);
	} catch {
		return null;
	}
}

/** Off by more than this, live sharing over Nostr won't connect. */
export const MAX_SKEW_MS = 5 * 60_000;

export function describeSkew(ms: number): string {
	const minutes = Math.round(Math.abs(ms) / 60_000);
	const amount =
		minutes >= 90 ? `about ${Math.round(minutes / 60)} hours` : `about ${minutes} minutes`;
	return `${amount} ${ms > 0 ? 'ahead' : 'behind'}`;
}
