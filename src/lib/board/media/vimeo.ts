import { BaseController, clamp01 } from './controller';
import { HANDSHAKE_MS } from './youtube';

export const VIMEO_ORIGIN = 'https://player.vimeo.com';
const EVENTS = [
	'play',
	'pause',
	'ended',
	'timeupdate',
	'progress',
	'volumechange',
	'playbackratechange',
	'error'
];

/** Talks to a Vimeo embed with its postMessage API (no Vimeo script runs in this page). */
export class VimeoController extends BaseController {
	readonly #frame: HTMLIFrameElement;
	readonly #win: Window;
	#timeout = 0;

	constructor(frame: HTMLIFrameElement, win: Window = window) {
		super();
		this.#frame = frame;
		this.#win = win;
		this.can = { rate: true, pip: false, captions: false };
		win.addEventListener('message', this.#onMessage);
		this.#timeout = win.setTimeout(() => {
			if (!this.state.ready) this.update({ fallback: true });
		}, HANDSHAKE_MS);
	}

	#post(method: string, value?: unknown): void {
		this.#frame.contentWindow?.postMessage(
			JSON.stringify(value === undefined ? { method } : { method, value }),
			VIMEO_ORIGIN
		);
	}

	readonly #onMessage = (e: MessageEvent): void => {
		if (e.origin !== VIMEO_ORIGIN || e.source !== this.#frame.contentWindow) return;
		let data: unknown = e.data;
		if (typeof data === 'string') {
			try {
				data = JSON.parse(data);
			} catch {
				return;
			}
		}
		if (!data || typeof data !== 'object') return;
		const msg = data as { event?: unknown; method?: unknown; value?: unknown; data?: unknown };
		const d = (msg.data && typeof msg.data === 'object' ? msg.data : {}) as Record<string, unknown>;
		const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
		switch (msg.event) {
			case 'ready':
				this.#win.clearTimeout(this.#timeout);
				for (const ev of EVENTS) this.#post('addEventListener', ev);
				this.#post('getDuration');
				this.#post('getVolume');
				// An autoplaying player sends no "play" event: ask.
				this.#post('getPaused');
				this.update({ ready: true });
				return;
			case 'play':
				this.update({ playing: true, ended: false });
				return;
			case 'pause':
				this.update({ playing: false });
				return;
			case 'ended':
				this.update({ playing: false, ended: true });
				return;
			case 'timeupdate':
				this.update({
					time: num(d.seconds) ?? this.state.time,
					duration: num(d.duration) ?? this.state.duration
				});
				return;
			case 'progress':
				this.update({ buffered: clamp01(num(d.percent) ?? 0) });
				return;
			case 'volumechange':
				this.update({ volume: clamp01(num(d.volume) ?? this.state.volume) });
				return;
			case 'playbackratechange':
				this.update({ rate: num(d.playbackRate) ?? this.state.rate });
				return;
			case 'error':
				// Speed changes are refused for videos whose owner's plan doesn't allow them.
				if (d.method === 'setPlaybackRate') {
					this.can = { ...this.can, rate: false };
					this.notify();
				} else this.update({ error: 'The video can’t be played here' });
				return;
		}
		if (msg.method === 'getDuration') this.update({ duration: num(msg.value) ?? 0 });
		if (msg.method === 'getVolume') this.update({ volume: clamp01(num(msg.value) ?? 1) });
		if (msg.method === 'getPaused' && typeof msg.value === 'boolean')
			this.update({ playing: !msg.value });
	};

	play(): void {
		this.#post('play');
	}
	pause(): void {
		this.#post('pause');
	}
	seek(seconds: number): void {
		this.#post('setCurrentTime', Math.max(0, seconds));
		this.update({ time: Math.max(0, seconds), ended: false });
	}
	setVolume(volume: number): void {
		this.#post('setVolume', clamp01(volume));
		this.update({ volume: clamp01(volume) });
	}
	setMuted(muted: boolean): void {
		this.#post('setMuted', muted);
		this.update({ muted });
	}
	setRate(rate: number): void {
		this.#post('setPlaybackRate', rate);
	}

	override destroy(): void {
		this.#win.removeEventListener('message', this.#onMessage);
		this.#win.clearTimeout(this.#timeout);
		super.destroy();
	}
}
