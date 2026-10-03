import { beforeEach, describe, expect, it } from 'vitest';
import { createElements } from '$lib/model/ops';
import { samples } from '$lib/model/testFixtures';
import { testCtx } from '../testCtx';
import { setClipEdge, stepRate, toggleLoop, clearClip } from './commands';
import { BaseController } from './controller';
import { handleMediaKey } from './keys';
import { readMediaPrefs, writeMediaPrefs } from './mediaPrefs';
import { playInClip, runSession } from './session';

/** A controller that records calls and lets tests set its state. */
class FakeController extends BaseController {
	calls: string[] = [];
	set(patch: Partial<typeof this.state>) {
		this.update(patch);
	}
	play() {
		this.calls.push('play');
		this.update({ playing: true });
	}
	pause() {
		this.calls.push('pause');
		this.update({ playing: false });
	}
	seek(t: number) {
		this.calls.push(`seek ${t}`);
		this.update({ time: t, ended: false });
	}
	setVolume(v: number) {
		this.calls.push(`volume ${v}`);
		this.update({ volume: v });
	}
	setMuted(m: boolean) {
		this.calls.push(`muted ${m}`);
		this.update({ muted: m });
	}
	setRate(r: number) {
		this.calls.push(`rate ${r}`);
		this.update({ rate: r });
	}
}

beforeEach(() => localStorage.clear());

describe('runSession', () => {
	it('applies personal settings once ready and enforces the clip', () => {
		writeMediaPrefs({ volume: 0.3, rate: 1.5 });
		const c = new FakeController();
		const clip = { start: 10, end: 20, loop: false };
		runSession(c, () => clip);
		c.set({ ready: true, duration: 60, time: 10, playing: true });
		expect(c.calls).toEqual(['volume 0.3', 'muted false', 'rate 1.5']);
		c.set({ time: 19.9 });
		expect(c.calls.at(-1)).toBe('pause');
		clip.loop = true;
		c.play();
		c.set({ time: 20 });
		expect(c.calls.slice(-2)).toEqual(['seek 10', 'play']);
	});

	it('playInClip starts over from the clip start at its end', () => {
		const c = new FakeController();
		c.set({ duration: 60, time: 20 });
		playInClip(c, { start: 10, end: 20, loop: false });
		expect(c.calls).toEqual(['seek 10', 'play']);
	});
});

describe('board writes', () => {
	it('loop and clip edges are undoable board data, clamped', () => {
		const ctx = testCtx();
		createElements(ctx.doc, [samples.media('m')]);
		const media = () => ctx.store.get('m') as ReturnType<typeof samples.media>;
		const c = new FakeController();
		c.set({ duration: 60, time: 12.34 });
		toggleLoop(ctx, media());
		setClipEdge(ctx, media(), c, 'start');
		c.set({ time: 5 });
		setClipEdge(ctx, media(), c, 'end'); // before the start: ignored
		c.set({ time: 30 });
		setClipEdge(ctx, media(), c, 'end');
		expect(media()).toMatchObject({ loop: true, start: 12.3, end: 30 });
		ctx.undo.undo();
		expect(media()).toMatchObject({ start: 12.3, end: null });
		clearClip(ctx, media());
		expect(media()).toMatchObject({ start: 0, end: null });
	});

	it('speed steps through the list and is remembered per browser', () => {
		const c = new FakeController();
		stepRate(c, 1);
		expect(c.state.rate).toBe(1.25);
		stepRate(c, -1);
		stepRate(c, -1);
		expect(c.state.rate).toBe(0.75);
		expect(readMediaPrefs().rate).toBe(0.75);
	});
});

describe('handleMediaKey', () => {
	const key = (k: string, extra: KeyboardEventInit = {}) =>
		new KeyboardEvent('keydown', { key: k, ...extra });
	function setup() {
		const ctx = testCtx();
		createElements(ctx.doc, [samples.media('m'), samples.shape('s')]);
		const c = new FakeController();
		c.set({ duration: 100, time: 50 });
		ctx.playback.play('m');
		ctx.playback.register('m', c);
		return { ctx, c };
	}

	it('controls the selected playing media', () => {
		const { ctx, c } = setup();
		ctx.selection.set(['m']);
		expect(handleMediaKey(ctx, key(' '))).toBe(true);
		expect(c.state.playing).toBe(true);
		handleMediaKey(ctx, key('ArrowRight'));
		expect(c.state.time).toBe(55);
		handleMediaKey(ctx, key('3'));
		expect(c.state.time).toBe(30);
		handleMediaKey(ctx, key('m'));
		expect(c.state.muted).toBe(true);
		handleMediaKey(ctx, key('L', { shiftKey: true }));
		expect((ctx.store.get('m') as { loop: boolean }).loop).toBe(true);
	});

	it('leaves keys alone without a playing media target, or with modifiers', () => {
		const { ctx } = setup();
		ctx.selection.set(['s']);
		expect(handleMediaKey(ctx, key(' '))).toBe(false);
		ctx.selection.set(['m']);
		expect(handleMediaKey(ctx, key('k', { ctrlKey: true }))).toBe(false);
		expect(handleMediaKey(ctx, key('q'))).toBe(false);
		ctx.playback.stop('m');
		ctx.playback.controllers.delete('m');
		expect(handleMediaKey(ctx, key(' '))).toBe(false);
	});
});

describe('one at a time', () => {
	it('starting one pauses the others (a personal setting)', () => {
		const ctx = testCtx();
		const a = new FakeController();
		const b = new FakeController();
		ctx.playback.play('a');
		ctx.playback.register('a', a);
		a.play();
		ctx.playback.play('b');
		ctx.playback.register('b', b);
		expect(a.state.playing).toBe(false);
		// Also when a player starts by itself (autoplay, its own button).
		a.play();
		expect(b.state.playing).toBe(false);
		writeMediaPrefs({ oneAtATime: false });
		a.play();
		ctx.playback.play('b');
		expect(a.state.playing).toBe(true);
	});
});
