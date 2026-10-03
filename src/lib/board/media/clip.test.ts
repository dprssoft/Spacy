import { describe, expect, it } from 'vitest';
import { clampClip, clipAction } from './clip';

describe('clampClip', () => {
	it('keeps 0 ≤ start < end ≤ duration', () => {
		expect(clampClip({ start: 10, end: 20, loop: false }, 60)).toEqual({ start: 10, end: 20 });
		expect(clampClip({ start: -5, end: 99, loop: false }, 60)).toEqual({ start: 0, end: 60 });
		expect(clampClip({ start: 30, end: 10, loop: false }, 60)).toEqual({ start: 30, end: null });
		expect(clampClip({ start: 90, end: null, loop: false }, 60)).toEqual({ start: 59, end: null });
		expect(clampClip({ start: 90, end: null, loop: false }, 0)).toEqual({ start: 90, end: null });
	});
});

describe('clipAction', () => {
	const clip = (end: number | null, loop = false) => ({ start: 5, end, loop });
	it('stops at the clip end, or restarts when looping', () => {
		expect(clipAction(10, 60, clip(20))).toBe('none');
		expect(clipAction(19.9, 60, clip(20))).toBe('stop');
		expect(clipAction(21, 60, clip(20, true))).toBe('restart');
	});
	it('without an end: loops at the media end, otherwise lets it end', () => {
		expect(clipAction(59.9, 60, clip(null, true))).toBe('restart');
		expect(clipAction(59.9, 60, clip(null))).toBe('none');
		expect(clipAction(3, 60, clip(null, true), true)).toBe('restart');
	});
	it('an end past the duration acts at the duration', () => {
		expect(clipAction(59.9, 60, clip(500))).toBe('stop');
		expect(clipAction(30, 0, clip(null, true))).toBe('none');
	});
});
