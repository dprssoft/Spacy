import { afterEach, describe, expect, it, vi } from 'vitest';
import { samples } from '$lib/model/testFixtures';
import type { WidgetElement } from '$lib/model/types';
import { now, setClockSkew } from './clock';
import { widgetSvg } from './face';
import { widgetView } from './kinds';
import { actionAt, fitDesign, primaryAction } from './layout';
import './index';

// A 240 × 240 timer: buttons at y 192–228; toggle at x 118–174, reset at 66–110.
const timer = (box: Partial<WidgetElement> = {}): WidgetElement => ({
	...samples.widget(),
	x: 0,
	y: 0,
	w: 240,
	h: 240,
	...box
});

describe('widget layout', () => {
	it('fits the design space into the box, centred', () => {
		expect(fitDesign({ w: 240, h: 240 }, { w: 480, h: 240 })).toEqual({ scale: 1, dx: 120, dy: 0 });
		expect(fitDesign({ w: 240, h: 240 }, { w: 120, h: 120 })).toEqual({ scale: 0.5, dx: 0, dy: 0 });
	});

	it('finds the button under a point at any size and position', () => {
		expect(actionAt(timer(), { x: 140, y: 210 }, 0)?.id).toBe('toggle');
		expect(actionAt(timer(), { x: 80, y: 210 }, 0)?.id).toBe('reset');
		expect(actionAt(timer(), { x: 120, y: 100 }, 0)).toBeNull();
		// Twice as big, moved: the same spots scale with it.
		const big = timer({ x: 1000, y: -500, w: 480, h: 480 });
		expect(actionAt(big, { x: 1000 + 280, y: -500 + 420 }, 0)?.id).toBe('toggle');
		// Wider than tall: centred horizontally.
		const wide = timer({ w: 480 });
		expect(actionAt(wide, { x: 120 + 140, y: 210 }, 0)?.id).toBe('toggle');
		expect(actionAt(wide, { x: 100, y: 210 }, 0)).toBeNull();
	});

	it('has no buttons for an unknown kind, and shows a placeholder', () => {
		const el = timer({ kind: 'hologram' });
		expect(actionAt(el, { x: 140, y: 210 }, 0)).toBeNull();
		expect(primaryAction(el, 0)).toBeNull();
		expect(widgetView(el, 0).face.caption).toMatch(/newer version/);
	});

	it('draws escaped text', () => {
		const svg = widgetSvg(timer({ title: '<b>&"' }), 0);
		expect(svg).toContain('&#60;b&#62;&#38;&#34;');
		expect(svg).not.toContain('<b>');
	});
});

describe('widget clock', () => {
	afterEach(() => {
		setClockSkew(null);
		vi.useRealTimers();
	});

	it('corrects a clock that is off, but not by less than the measurement noise', () => {
		vi.useFakeTimers({ now: 1_000_000 });
		setClockSkew(3 * 3600_000);
		expect(now()).toBe(1_000_000 - 3 * 3600_000);
		setClockSkew(1500);
		expect(now()).toBe(1_000_000);
		setClockSkew(-5000);
		expect(now()).toBe(1_005_000);
	});
});
