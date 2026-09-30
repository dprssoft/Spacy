/**
 * Coalesces rapid updates (pointer moves) into at most one `apply` per animation frame,
 * always with the latest value.
 */
export function createRafWriter<T>(apply: (latest: T) => void) {
	let frame = 0;
	let latest: T | undefined;
	let has = false;

	const run = () => {
		frame = 0;
		if (!has) return;
		has = false;
		apply(latest as T);
	};

	return {
		push(value: T): void {
			latest = value;
			has = true;
			if (!frame) frame = requestAnimationFrame(run);
		},
		/** Applies a pending value now (call at gesture end). */
		flush(): void {
			if (frame) cancelAnimationFrame(frame);
			run();
		},
		cancel(): void {
			if (frame) cancelAnimationFrame(frame);
			frame = 0;
			has = false;
		}
	};
}
