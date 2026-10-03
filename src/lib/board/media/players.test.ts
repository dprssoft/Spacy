import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NativeController } from './native';
import { VIMEO_ORIGIN, VimeoController } from './vimeo';
import { HANDSHAKE_MS, YOUTUBE_ORIGIN, YouTubeController } from './youtube';

type Listener = (e: { origin: string; source: unknown; data: unknown }) => void;

/** A page window and a player iframe whose window records what it's sent. */
function fakes() {
	const listeners = new Set<Listener>();
	const player = {
		sent: [] as { msg: unknown; origin: string }[],
		postMessage(msg: string, origin: string) {
			this.sent.push({ msg: JSON.parse(msg), origin });
		}
	};
	const win = {
		addEventListener: (_: string, l: Listener) => listeners.add(l),
		removeEventListener: (_: string, l: Listener) => listeners.delete(l),
		setInterval: (f: () => void, ms: number) => setInterval(f, ms),
		clearInterval: (id: number) => clearInterval(id),
		setTimeout: (f: () => void, ms: number) => setTimeout(f, ms),
		clearTimeout: (id: number) => clearTimeout(id)
	};
	const frame = { contentWindow: player } as unknown as HTMLIFrameElement;
	const receive = (data: unknown, origin: string, source: unknown = player) => {
		for (const l of listeners) l({ origin, source, data });
	};
	return { win: win as unknown as Window, frame, player, receive, listeners };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('YouTubeController', () => {
	it('says it is listening until the player answers, then reads its info', () => {
		const f = fakes();
		const c = new YouTubeController(f.frame, f.win);
		vi.advanceTimersByTime(600);
		expect(
			f.player.sent.filter((s) => (s.msg as { event: string }).event === 'listening').length
		).toBeGreaterThan(1);
		expect(f.player.sent.every((s) => s.origin === YOUTUBE_ORIGIN)).toBe(true);

		f.receive(
			JSON.stringify({
				event: 'infoDelivery',
				info: {
					currentTime: 12,
					duration: 300,
					playerState: 1,
					volume: 40,
					muted: false,
					playbackRate: 1.5,
					videoLoadedFraction: 0.3
				}
			}),
			YOUTUBE_ORIGIN
		);
		expect(c.state).toMatchObject({
			ready: true,
			time: 12,
			duration: 300,
			playing: true,
			volume: 0.4,
			rate: 1.5,
			buffered: 0.3
		});
		const before = f.player.sent.length;
		vi.advanceTimersByTime(1000);
		expect(f.player.sent.length).toBe(before); // stopped saying hello
	});

	it('sends commands as the IFrame API does', () => {
		const f = fakes();
		const c = new YouTubeController(f.frame, f.win);
		f.player.sent = [];
		c.play();
		c.seek(42);
		c.setVolume(0.25);
		c.setMuted(true);
		c.setRate(2);
		expect(f.player.sent.map((s) => s.msg)).toEqual([
			{ event: 'command', func: 'playVideo', args: [], id: 1, channel: 'widget' },
			{ event: 'command', func: 'seekTo', args: [42, true], id: 1, channel: 'widget' },
			{ event: 'command', func: 'setVolume', args: [25], id: 1, channel: 'widget' },
			{ event: 'command', func: 'mute', args: [], id: 1, channel: 'widget' },
			{ event: 'command', func: 'setPlaybackRate', args: [2], id: 1, channel: 'widget' }
		]);
	});

	it('ignores messages from other windows, other origins and garbage', () => {
		const f = fakes();
		const c = new YouTubeController(f.frame, f.win);
		const info = JSON.stringify({ event: 'infoDelivery', info: { currentTime: 99 } });
		f.receive(info, 'https://evil.example');
		f.receive(info, YOUTUBE_ORIGIN, { postMessage() {} });
		f.receive('{not json', YOUTUBE_ORIGIN);
		f.receive(42, YOUTUBE_ORIGIN);
		expect(c.state.ready).toBe(false);
		expect(c.state.time).toBe(0);
	});

	it('falls back to the player’s controls when it never answers', () => {
		const f = fakes();
		const c = new YouTubeController(f.frame, f.win);
		vi.advanceTimersByTime(HANDSHAKE_MS + 10);
		expect(c.state.fallback).toBe(true);
		c.destroy();
		expect(f.listeners.size).toBe(0);
	});
});

describe('VimeoController', () => {
	it('subscribes to events on ready and follows them', () => {
		const f = fakes();
		const c = new VimeoController(f.frame, f.win);
		f.receive({ event: 'ready' }, VIMEO_ORIGIN);
		const methods = f.player.sent.map((s) => s.msg as { method: string; value?: string });
		expect(methods.filter((m) => m.method === 'addEventListener').map((m) => m.value)).toContain(
			'timeupdate'
		);
		expect(f.player.sent.every((s) => s.origin === VIMEO_ORIGIN)).toBe(true);
		f.receive(
			JSON.stringify({ event: 'timeupdate', data: { seconds: 7, duration: 70 } }),
			VIMEO_ORIGIN
		);
		f.receive({ event: 'play' }, VIMEO_ORIGIN);
		expect(c.state).toMatchObject({ ready: true, time: 7, duration: 70, playing: true });
	});

	it('hides speed when the video refuses it; falls back without an answer', () => {
		const f = fakes();
		const c = new VimeoController(f.frame, f.win);
		f.receive({ event: 'ready' }, VIMEO_ORIGIN);
		f.receive({ event: 'error', data: { method: 'setPlaybackRate', name: 'Error' } }, VIMEO_ORIGIN);
		expect(c.can.rate).toBe(false);
		const g = fakes();
		const silent = new VimeoController(g.frame, g.win);
		vi.advanceTimersByTime(HANDSHAKE_MS + 10);
		expect(silent.state.fallback).toBe(true);
	});
});

describe('NativeController', () => {
	it('follows the media element and drives it', () => {
		const v = document.createElement('video');
		Object.defineProperty(v, 'duration', { value: 30, configurable: true });
		let paused = true;
		Object.defineProperty(v, 'paused', { get: () => paused, configurable: true });
		v.play = () => {
			paused = false;
			v.dispatchEvent(new Event('play'));
			return Promise.resolve();
		};
		v.pause = () => {
			paused = true;
			v.dispatchEvent(new Event('pause'));
		};
		const c = new NativeController(v);
		const seen: boolean[] = [];
		c.subscribe(() => seen.push(c.state.playing));
		c.play();
		expect(c.state.playing).toBe(true);
		c.seek(12);
		v.dispatchEvent(new Event('timeupdate'));
		expect(c.state.time).toBe(12);
		c.setVolume(2);
		expect(v.volume).toBe(1);
		c.pause();
		expect(seen.at(-1)).toBe(false);
		v.dispatchEvent(new Event('error'));
		expect(c.state.error).toBe('Can’t play this file');
	});
});

describe('VimeoController autoplay', () => {
	it('asks whether an autoplaying player is paused', () => {
		const f = fakes();
		const c = new VimeoController(f.frame, f.win);
		f.receive({ event: 'ready' }, VIMEO_ORIGIN);
		expect(f.player.sent.map((s) => (s.msg as { method: string }).method)).toContain('getPaused');
		f.receive({ method: 'getPaused', value: false }, VIMEO_ORIGIN);
		expect(c.state.playing).toBe(true);
	});
});
