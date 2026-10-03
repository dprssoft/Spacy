// Screen-size and input facts the UI adapts to (phones get a compact layout; touch gets bigger
// targets). Kept in sync with the media queries for the app's lifetime.

const query = (q: string) => (typeof matchMedia === 'function' ? matchMedia(q) : null);

/** Tailwind's `sm` breakpoint: below it is a phone. */
export const COMPACT_QUERY = '(max-width: 639px)';
export const COARSE_QUERY = '(pointer: coarse)';

class LayoutState {
	compact = $state(false);
	coarse = $state(false);

	constructor() {
		for (const [key, q] of [
			['compact', COMPACT_QUERY],
			['coarse', COARSE_QUERY]
		] as const) {
			const mq = query(q);
			if (!mq) continue;
			this[key] = mq.matches;
			mq.addEventListener?.('change', (e) => (this[key] = e.matches));
		}
	}
}

export const layout = new LayoutState();
