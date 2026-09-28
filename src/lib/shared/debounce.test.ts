import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce, throttle } from './debounce';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('debounce', () => {
	it('runs once after the last call with the latest arguments', () => {
		const fn = vi.fn();
		const d = debounce(fn, 100);
		d(1);
		vi.advanceTimersByTime(50);
		d(2);
		vi.advanceTimersByTime(99);
		expect(fn).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(fn).toHaveBeenCalledExactlyOnceWith(2);
	});

	it('flushes a pending call immediately and returns its result', () => {
		const d = debounce((x: number) => x * 2, 100);
		expect(d.flush()).toBeUndefined();
		d(21);
		expect(d.pending).toBe(true);
		expect(d.flush()).toBe(42);
		expect(d.pending).toBe(false);
		vi.advanceTimersByTime(200);
		expect(d.flush()).toBeUndefined();
	});

	it('cancels a pending call', () => {
		const fn = vi.fn();
		const d = debounce(fn, 100);
		d();
		d.cancel();
		vi.advanceTimersByTime(200);
		expect(fn).not.toHaveBeenCalled();
	});
});

describe('throttle', () => {
	it('runs the first call immediately and the last call at the end of the window', () => {
		const fn = vi.fn();
		const t = throttle(fn, 100);
		t(1);
		t(2);
		t(3);
		expect(fn.mock.calls).toEqual([[1]]);
		vi.advanceTimersByTime(100);
		expect(fn.mock.calls).toEqual([[1], [3]]);
		vi.advanceTimersByTime(100);
		t(4);
		expect(fn.mock.calls).toEqual([[1], [3], [4]]);
	});

	it('cancels the trailing call', () => {
		const fn = vi.fn();
		const t = throttle(fn, 100);
		t(1);
		t(2);
		t.cancel();
		vi.advanceTimersByTime(200);
		expect(fn.mock.calls).toEqual([[1]]);
	});
});
