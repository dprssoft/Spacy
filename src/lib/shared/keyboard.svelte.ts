// How much of the bottom of the window the on-screen keyboard covers (0 without one), from
// `visualViewport`. Tests can simulate a keyboard (Playwright has none).

class KeyboardState {
	inset = $state(0);
	#override: number | null = null;

	constructor() {
		const vv = typeof window === 'undefined' ? null : window.visualViewport;
		if (!vv) return;
		const update = () => {
			if (this.#override === null) this.inset = this.#measure();
		};
		vv.addEventListener('resize', update);
		vv.addEventListener('scroll', update);
		update();
	}

	#measure(): number {
		const vv = window.visualViewport;
		return vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
	}

	/** The visible bottom edge in client coordinates. */
	get visibleBottom(): number {
		return window.innerHeight - this.inset;
	}

	/** Test hook: pretend a keyboard of `px` is open (null: measure again). */
	simulate(px: number | null): void {
		this.#override = px;
		this.inset = px ?? this.#measure();
	}
}

export const keyboard = new KeyboardState();

/**
 * How far to move content vertically so `rect` sits inside [top, bottom] with `margin` (client
 * px; negative = up). Rects taller than the space are aligned by their bottom (the caret line).
 */
export function keepInView(
	rect: { top: number; bottom: number },
	top: number,
	bottom: number,
	margin = 12
): number {
	if (rect.bottom > bottom - margin) return bottom - margin - rect.bottom;
	if (rect.top < top + margin && rect.bottom - rect.top < bottom - top - 2 * margin)
		return top + margin - rect.top;
	return 0;
}
