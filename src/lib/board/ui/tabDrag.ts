// Pure helpers for reordering sheet tabs by dragging.

/** The gap (0…n) a pointer at `x` drops into: before the first tab whose middle is right of it. */
export function dropSlot(tabs: readonly { left: number; right: number }[], x: number): number {
	const i = tabs.findIndex((r) => x < (r.left + r.right) / 2);
	return i < 0 ? tabs.length : i;
}

/**
 * Follows a tab drag from its pointerdown. Nothing happens until the pointer moves 5 px; then
 * `onMove` gets the gap under the pointer. `onEnd` gets the gap to drop into, or null when the
 * drag was cancelled (Escape, pointercancel); it isn't called if the drag never started.
 */
export function trackTabDrag(
	start: PointerEvent,
	opts: {
		tabs: () => readonly Element[];
		onMove: (slot: number) => void;
		onEnd: (slot: number | null) => void;
	}
): void {
	let slot: number | null = null;
	const move = (e: PointerEvent) => {
		if (slot === null && Math.abs(e.clientX - start.clientX) < 5) return;
		slot = dropSlot(
			opts.tabs().map((t) => t.getBoundingClientRect()),
			e.clientX
		);
		opts.onMove(slot);
	};
	const end = (drop: boolean) => {
		window.removeEventListener('pointermove', move);
		window.removeEventListener('pointerup', up);
		window.removeEventListener('pointercancel', cancel);
		window.removeEventListener('keydown', esc, true);
		if (slot !== null) opts.onEnd(drop ? slot : null);
	};
	const up = () => end(true);
	const cancel = () => end(false);
	const esc = (e: KeyboardEvent) => {
		if (e.key !== 'Escape' || slot === null) return;
		e.preventDefault();
		e.stopPropagation();
		end(false);
	};
	window.addEventListener('pointermove', move);
	window.addEventListener('pointerup', up);
	window.addEventListener('pointercancel', cancel);
	window.addEventListener('keydown', esc, true);
}
