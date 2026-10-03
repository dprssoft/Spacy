import { BaseController, clamp01 } from './controller';

/** A native <video>/<audio> element. */
export class NativeController extends BaseController {
	readonly #el: HTMLMediaElement;
	readonly #off: (() => void)[] = [];

	constructor(el: HTMLMediaElement) {
		super();
		this.#el = el;
		this.can = {
			rate: true,
			pip:
				typeof HTMLVideoElement !== 'undefined' &&
				el instanceof HTMLVideoElement &&
				typeof document !== 'undefined' &&
				!!document.pictureInPictureEnabled,
			captions: el.textTracks?.length > 0
		};
		const sync = () => this.#sync();
		for (const ev of [
			'play',
			'pause',
			'playing',
			'timeupdate',
			'durationchange',
			'loadedmetadata',
			'progress',
			'volumechange',
			'ratechange',
			'ended',
			'seeked'
		]) {
			el.addEventListener(ev, sync);
			this.#off.push(() => el.removeEventListener(ev, sync));
		}
		const onError = () => this.update({ error: 'Can’t play this file' });
		el.addEventListener('error', onError);
		this.#off.push(() => el.removeEventListener('error', onError));
		this.#sync();
	}

	#sync(): void {
		const el = this.#el;
		const duration = Number.isFinite(el.duration) ? el.duration : 0;
		const ranges = el.buffered;
		const loaded = ranges && ranges.length ? ranges.end(ranges.length - 1) : 0;
		this.update({
			playing: !el.paused && !el.ended,
			time: el.currentTime || 0,
			duration,
			buffered: duration ? clamp01(loaded / duration) : 0,
			volume: el.volume,
			muted: el.muted,
			rate: el.playbackRate,
			ready: el.readyState > 0,
			ended: el.ended
		});
	}

	play(): void {
		void this.#el.play()?.catch(() => {});
	}
	pause(): void {
		this.#el.pause();
	}
	seek(seconds: number): void {
		this.#el.currentTime = Math.max(0, seconds);
	}
	setVolume(volume: number): void {
		this.#el.volume = clamp01(volume);
	}
	setMuted(muted: boolean): void {
		this.#el.muted = muted;
	}
	setRate(rate: number): void {
		this.#el.playbackRate = rate;
	}

	/** Picture-in-picture (video only). */
	togglePip(): void {
		if (!(this.#el instanceof HTMLVideoElement)) return;
		if (document.pictureInPictureElement) void document.exitPictureInPicture().catch(() => {});
		else void this.#el.requestPictureInPicture().catch(() => {});
	}

	/** Shows the first text track, or hides all; returns whether captions are now on. */
	toggleCaptions(): boolean {
		const tracks = [...this.#el.textTracks];
		const on = tracks.some((t) => t.mode === 'showing');
		tracks.forEach((t, i) => (t.mode = !on && i === 0 ? 'showing' : 'hidden'));
		this.notify();
		return !on;
	}

	override destroy(): void {
		for (const off of this.#off) off();
		super.destroy();
	}
}
