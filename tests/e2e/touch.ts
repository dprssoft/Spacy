import type { CDPSession, Page } from '@playwright/test';

type P = { x: number; y: number };

/** Real touch input through the DevTools protocol (Playwright only has taps). */
export class Touch {
	#cdp: CDPSession | null = null;
	constructor(private readonly page: Page) {}

	async #send(type: 'touchStart' | 'touchMove' | 'touchEnd', points: P[]) {
		this.#cdp ??= await this.page.context().newCDPSession(this.page);
		await this.#cdp.send('Input.dispatchTouchEvent', {
			type,
			touchPoints: points.map((p, i) => ({
				x: p.x,
				y: p.y,
				id: i + 1,
				radiusX: 4,
				radiusY: 4,
				force: 1
			}))
		});
	}

	/** One finger from `a` to `b` in `steps` moves; `holdMs` waits before moving (long-press). */
	async drag(a: P, b: P, opts: { steps?: number; holdMs?: number } = {}) {
		const steps = opts.steps ?? 10;
		await this.#send('touchStart', [a]);
		if (opts.holdMs) await this.page.waitForTimeout(opts.holdMs);
		for (let i = 1; i <= steps; i++) {
			const t = i / steps;
			await this.#send('touchMove', [{ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }]);
		}
		await this.#send('touchEnd', []);
	}

	/** Two fingers: from `a1`/`a2` to `b1`/`b2`. The first finger lands a moment earlier. */
	async pinch(a1: P, a2: P, b1: P, b2: P, steps = 10) {
		await this.#send('touchStart', [a1]);
		await this.#send('touchStart', [a1, a2]);
		for (let i = 1; i <= steps; i++) {
			const t = i / steps;
			const lerp = (a: P, b: P) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
			await this.#send('touchMove', [lerp(a1, b1), lerp(a2, b2)]);
		}
		await this.#send('touchEnd', []);
	}

	async tap(p: P) {
		await this.#send('touchStart', [p]);
		await this.#send('touchEnd', []);
	}

	async doubleTap(p: P) {
		await this.tap(p);
		await this.page.waitForTimeout(80);
		await this.tap(p);
	}
}
