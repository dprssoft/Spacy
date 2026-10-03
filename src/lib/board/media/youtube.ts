import { BaseController, clamp01 } from './controller';

export const YOUTUBE_ORIGIN = 'https://www.youtube-nocookie.com';
/** How long the player gets to answer before we fall back to its own controls. */
export const HANDSHAKE_MS = 4000;

type Info = {
	currentTime?: number;
	duration?: number;
	playerState?: number;
	volume?: number;
	muted?: boolean;
	playbackRate?: number;
	videoLoadedFraction?: number;
};

/**
 * Talks to a YouTube embed over postMessage, the protocol the official IFrame API uses, without
 * loading any YouTube script into this page. Messages are accepted only from that iframe's
 * window and YouTube's origin.
 */
export class YouTubeController extends BaseController {
	readonly #frame: HTMLIFrameElement;
	readonly #win: Window;
	#listen = 0;
	#timeout = 0;

	constructor(frame: HTMLIFrameElement, win: Window = window) {
		super();
		this.#frame = frame;
		this.#win = win;
		this.can = { rate: true, pip: false, captions: false };
		win.addEventListener('message', this.#onMessage);
		// The player only reports to a page that says it's listening, and only once it's loaded:
		// keep saying so until it answers.
		const hello = () => this.#post({ event: 'listening', id: 1, channel: 'widget' });
		hello();
		this.#listen = win.setInterval(hello, 250);
		this.#timeout = win.setTimeout(() => {
			if (!this.state.ready) this.update({ fallback: true });
			win.clearInterval(this.#listen);
		}, HANDSHAKE_MS);
	}

	#post(msg: object): void {
		this.#frame.contentWindow?.postMessage(JSON.stringify(msg), YOUTUBE_ORIGIN);
	}

	#command(func: string, args: unknown[] = []): void {
		this.#post({ event: 'command', func, args, id: 1, channel: 'widget' });
	}

	readonly #onMessage = (e: MessageEvent): void => {
		if (e.origin !== YOUTUBE_ORIGIN || e.source !== this.#frame.contentWindow) return;
		let data: unknown = e.data;
		if (typeof data === 'string') {
			try {
				data = JSON.parse(data);
			} catch {
				return;
			}
		}
		if (!data || typeof data !== 'object') return;
		const msg = data as { event?: unknown; info?: unknown };
		if (
			msg.event === 'onReady' ||
			msg.event === 'initialDelivery' ||
			msg.event === 'infoDelivery'
		) {
			if (!this.state.ready) {
				this.#win.clearInterval(this.#listen);
				this.#win.clearTimeout(this.#timeout);
				this.update({ ready: true });
			}
			if (msg.info && typeof msg.info === 'object') this.#apply(msg.info as Info);
		} else if (msg.event === 'onError') {
			this.update({ error: 'The video can’t be played here' });
		}
	};

	#apply(info: Info): void {
		const patch: Partial<typeof this.state> = {};
		const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
		const t = num(info.currentTime);
		if (t !== undefined) patch.time = t;
		const d = num(info.duration);
		if (d !== undefined) patch.duration = d;
		const s = num(info.playerState);
		if (s !== undefined) {
			patch.playing = s === 1 || s === 3;
			patch.ended = s === 0;
		}
		const v = num(info.volume);
		if (v !== undefined) patch.volume = clamp01(v / 100);
		if (typeof info.muted === 'boolean') patch.muted = info.muted;
		const r = num(info.playbackRate);
		if (r !== undefined) patch.rate = r;
		const f = num(info.videoLoadedFraction);
		if (f !== undefined) patch.buffered = clamp01(f);
		this.update(patch);
	}

	play(): void {
		this.#command('playVideo');
	}
	pause(): void {
		this.#command('pauseVideo');
	}
	seek(seconds: number): void {
		this.#command('seekTo', [Math.max(0, seconds), true]);
		this.update({ time: Math.max(0, seconds), ended: false });
	}
	setVolume(volume: number): void {
		this.#command('setVolume', [Math.round(clamp01(volume) * 100)]);
		this.update({ volume: clamp01(volume) });
	}
	setMuted(muted: boolean): void {
		this.#command(muted ? 'mute' : 'unMute');
		this.update({ muted });
	}
	setRate(rate: number): void {
		this.#command('setPlaybackRate', [rate]);
	}

	override destroy(): void {
		this.#win.removeEventListener('message', this.#onMessage);
		this.#win.clearInterval(this.#listen);
		this.#win.clearTimeout(this.#timeout);
		super.destroy();
	}
}
