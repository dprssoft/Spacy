import { describe, expect, it } from 'vitest';
import { greekLines, SCENE_MIN_ELEMENTS, SCENE_ZOOM, useSceneCanvas } from './canvasScene';

describe('useSceneCanvas', () => {
	it('draws on a canvas only when zoomed out over many elements', () => {
		expect(useSceneCanvas(false, SCENE_ZOOM - 0.01, SCENE_MIN_ELEMENTS)).toBe(true);
		expect(useSceneCanvas(false, SCENE_ZOOM, 10_000)).toBe(false);
		expect(useSceneCanvas(false, 0.1, SCENE_MIN_ELEMENTS - 1)).toBe(false);
	});

	it('keeps the canvas while the count dips a little (no flip-flopping while panning)', () => {
		const dip = SCENE_MIN_ELEMENTS * 0.8;
		expect(useSceneCanvas(true, 0.1, dip)).toBe(true);
		expect(useSceneCanvas(false, 0.1, dip)).toBe(false);
		expect(useSceneCanvas(true, 0.1, SCENE_MIN_ELEMENTS * 0.5)).toBe(false);
		expect(useSceneCanvas(true, SCENE_ZOOM, 10_000)).toBe(false);
	});
});

describe('greekLines', () => {
	it('estimates wrapped line widths from the text length', () => {
		// 10 px glyphs at size 20: 30 characters are 300 px, wrapped at 120 px.
		expect(greekLines('a'.repeat(30), 120, 20)).toEqual([120, 120, 60]);
	});

	it('keeps explicit line breaks and unbounded boxes', () => {
		expect(greekLines('ab\ncd', Infinity, 20)).toEqual([20, 20]);
		expect(greekLines('', 100, 20)).toEqual([0]);
	});
});
