import { now } from './clock';

const INTERVAL_MS = 100;

/**
 * One shared clock for widgets whose face changes with time. It runs only while at least one
 * visible widget holds it (culled widgets are unmounted and let go), at most 10 times a second.
 */
class Ticker {
	now = $state(now());
	#holders = 0;
	#frame = 0;
	#last = 0;

	/** Keeps the clock running; call the returned function to let go. */
	hold(): () => void {
		this.#holders++;
		if (this.#holders === 1) this.#loop();
		let held = true;
		return () => {
			if (!held) return;
			held = false;
			this.#holders--;
			if (this.#holders === 0) cancelAnimationFrame(this.#frame);
		};
	}

	#loop = () => {
		const t = performance.now();
		if (t - this.#last >= INTERVAL_MS) {
			this.#last = t;
			this.now = now();
		}
		this.#frame = requestAnimationFrame(this.#loop);
	};

	/** Reads the current time now (outside the loop, e.g. right after a click). */
	refresh(): number {
		return (this.now = now());
	}
}

export const ticker = new Ticker();
