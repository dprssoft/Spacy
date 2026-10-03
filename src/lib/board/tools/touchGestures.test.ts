import { describe, expect, it } from 'vitest';
import { isDoubleTap, isQuickTap, LONG_PRESS_MS, TouchPress } from './touchGestures';

describe('TouchPress', () => {
	it('moving past the slop makes it a pan, and it stays one', () => {
		const p = new TouchPress({ x: 0, y: 0 }, 0);
		expect(p.move({ x: 3, y: 3 })).toBe('pending');
		expect(p.move({ x: 20, y: 0 })).toBe('pan');
		expect(p.hold(LONG_PRESS_MS + 1)).toBe(false);
		expect(p.move({ x: 0, y: 0 })).toBe('pan');
	});

	it('holding still becomes a long-press; lifting early is a tap', () => {
		const held = new TouchPress({ x: 0, y: 0 }, 0);
		expect(held.hold(LONG_PRESS_MS - 1)).toBe(false);
		expect(held.hold(LONG_PRESS_MS)).toBe(true);
		expect(held.isTap({ x: 0, y: 0 })).toBe(false);
		const tap = new TouchPress({ x: 0, y: 0 }, 0);
		expect(tap.isTap({ x: 4, y: 4 })).toBe(true);
	});
});

describe('taps', () => {
	it('quick taps and double taps', () => {
		expect(isQuickTap({ at: { x: 0, y: 0 }, t: 0 }, { at: { x: 2, y: 2 }, t: 120 })).toBe(true);
		expect(isQuickTap({ at: { x: 0, y: 0 }, t: 0 }, { at: { x: 2, y: 2 }, t: 700 })).toBe(false);
		const first = { at: { x: 10, y: 10 }, t: 1000 };
		expect(isDoubleTap(first, { at: { x: 14, y: 12 }, t: 1250 })).toBe(true);
		expect(isDoubleTap(first, { at: { x: 40, y: 10 }, t: 1250 })).toBe(false);
		expect(isDoubleTap(first, { at: { x: 10, y: 10 }, t: 1400 })).toBe(false);
		expect(isDoubleTap(null, first)).toBe(false);
	});
});
