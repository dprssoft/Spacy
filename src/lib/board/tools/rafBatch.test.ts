import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRafWriter } from './rafBatch';

let frames: FrameRequestCallback[] = [];
beforeEach(() => {
	frames = [];
	vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
	vi.stubGlobal('cancelAnimationFrame', () => {
		frames = [];
	});
});
afterEach(() => vi.unstubAllGlobals());

const runFrame = () => {
	const pending = frames;
	frames = [];
	for (const cb of pending) cb(performance.now());
};

describe('createRafWriter', () => {
	it('applies once per frame with the latest value', () => {
		const apply = vi.fn();
		const w = createRafWriter<number>(apply);
		w.push(1);
		w.push(2);
		w.push(3);
		expect(frames).toHaveLength(1);
		runFrame();
		expect(apply).toHaveBeenCalledExactlyOnceWith(3);
		runFrame();
		expect(apply).toHaveBeenCalledTimes(1);
	});

	it('flushes a pending value immediately', () => {
		const apply = vi.fn();
		const w = createRafWriter<string>(apply);
		w.push('a');
		w.flush();
		expect(apply).toHaveBeenCalledExactlyOnceWith('a');
		w.flush();
		expect(apply).toHaveBeenCalledTimes(1);
	});

	it('cancels a pending value', () => {
		const apply = vi.fn();
		const w = createRafWriter<number>(apply);
		w.push(1);
		w.cancel();
		runFrame();
		w.flush();
		expect(apply).not.toHaveBeenCalled();
	});
});
