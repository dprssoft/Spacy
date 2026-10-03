// One interface over the three kinds of player (native <video>/<audio>, YouTube and Vimeo
// iframes), so the board's own controls work the same for all of them. No Svelte here.

export interface MediaState {
	playing: boolean;
	time: number;
	duration: number;
	/** 0..1 of the media loaded. */
	buffered: number;
	/** 0..1 */
	volume: number;
	muted: boolean;
	rate: number;
	/** The player answered (its API is usable). */
	ready: boolean;
	/** The player didn't answer: fall back to its own controls. */
	fallback: boolean;
	ended: boolean;
	error: string | null;
}

export interface MediaCapabilities {
	rate: boolean;
	pip: boolean;
	captions: boolean;
}

export interface MediaController {
	readonly state: Readonly<MediaState>;
	readonly can: Readonly<MediaCapabilities>;
	play(): void;
	pause(): void;
	seek(seconds: number): void;
	setVolume(volume: number): void;
	setMuted(muted: boolean): void;
	setRate(rate: number): void;
	/** Called after every state change. Returns unsubscribe. */
	subscribe(fn: () => void): () => void;
	destroy(): void;
}

export const initialState = (): MediaState => ({
	playing: false,
	time: 0,
	duration: 0,
	buffered: 0,
	volume: 1,
	muted: false,
	rate: 1,
	ready: false,
	fallback: false,
	ended: false,
	error: null
});

/** Shared state and subscriptions for the adapters. */
export abstract class BaseController implements MediaController {
	state: MediaState = initialState();
	can: MediaCapabilities = { rate: true, pip: false, captions: false };
	#subs = new Set<() => void>();

	protected update(patch: Partial<MediaState>): void {
		let changed = false;
		for (const [k, v] of Object.entries(patch) as [keyof MediaState, never][]) {
			if (this.state[k] !== v) {
				(this.state as Record<keyof MediaState, unknown>)[k] = v;
				changed = true;
			}
		}
		if (changed) for (const fn of this.#subs) fn();
	}

	protected notify(): void {
		for (const fn of this.#subs) fn();
	}

	subscribe(fn: () => void): () => void {
		this.#subs.add(fn);
		return () => this.#subs.delete(fn);
	}

	abstract play(): void;
	abstract pause(): void;
	abstract seek(seconds: number): void;
	abstract setVolume(volume: number): void;
	abstract setMuted(muted: boolean): void;
	abstract setRate(rate: number): void;

	destroy(): void {
		this.#subs.clear();
	}
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
