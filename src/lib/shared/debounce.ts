export interface Debounced<A extends unknown[], R> {
	(...args: A): void;
	/** Runs a pending call now and returns its result (undefined if nothing was pending). */
	flush(): R | undefined;
	cancel(): void;
	readonly pending: boolean;
}

/** Trailing-edge debounce: runs `fn` once, `ms` after the last call. */
export function debounce<A extends unknown[], R>(
	fn: (...args: A) => R,
	ms: number
): Debounced<A, R> {
	let timer: ReturnType<typeof setTimeout> | null = null;
	let lastArgs: A | null = null;

	const run = (): R | undefined => {
		if (timer !== null) clearTimeout(timer);
		timer = null;
		if (!lastArgs) return undefined;
		const args = lastArgs;
		lastArgs = null;
		return fn(...args);
	};

	const debounced = (...args: A) => {
		lastArgs = args;
		if (timer !== null) clearTimeout(timer);
		timer = setTimeout(run, ms);
	};
	// defineProperties, not Object.assign: assign would copy the getter's value, not the getter.
	return Object.defineProperties(debounced, {
		flush: { value: run },
		cancel: {
			value() {
				if (timer !== null) clearTimeout(timer);
				timer = null;
				lastArgs = null;
			}
		},
		pending: { get: () => lastArgs !== null }
	}) as Debounced<A, R>;
}

/** Leading + trailing throttle: at most one call per `ms`, and the last call always runs. */
export function throttle<A extends unknown[]>(
	fn: (...args: A) => void,
	ms: number
): ((...args: A) => void) & { cancel(): void } {
	let last = -Infinity;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let lastArgs: A | null = null;

	const throttled = (...args: A) => {
		const now = Date.now();
		const wait = last + ms - now;
		if (wait <= 0 && timer === null) {
			last = now;
			fn(...args);
			return;
		}
		lastArgs = args;
		timer ??= setTimeout(
			() => {
				timer = null;
				last = Date.now();
				const a = lastArgs;
				lastArgs = null;
				if (a) fn(...a);
			},
			Math.max(wait, 0)
		);
	};
	return Object.assign(throttled, {
		cancel() {
			if (timer !== null) clearTimeout(timer);
			timer = null;
			lastArgs = null;
		}
	});
}
