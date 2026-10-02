import { describe, expect, it } from 'vitest';
import {
	parseStroke,
	strokeBounds,
	strokeHit,
	strokePaint,
	strokeReach,
	strokeWidth,
	type SketchStroke
} from './brushes';
import { firstFrame, growFrame, pointsToSketch, sketchHit, worldToSketch } from './geometry';

const line = (
	b: SketchStroke['b'],
	s = 10,
	p = [0, 0, 0.5, 50, 0, 0.5, 100, 0, 0.5]
): SketchStroke => ({
	b,
	c: '#1e1e1e',
	s,
	p
});

describe('brushes', () => {
	it('each brush paints its own way', () => {
		expect(strokePaint(line('pen'))).toMatchObject({ mode: 'fill', opacity: 1, erase: false });
		expect(strokePaint(line('pencil'))).toMatchObject({ mode: 'fill', opacity: 0.8, width: 6 });
		expect(strokePaint(line('marker'))).toMatchObject({ mode: 'stroke', width: 10, cap: 'round' });
		expect(strokePaint(line('highlighter'))).toMatchObject({
			mode: 'stroke',
			width: 25,
			opacity: 0.35,
			cap: 'round'
		});
		expect(strokePaint(line('eraser'))).toMatchObject({ mode: 'stroke', erase: true, width: 20 });
		for (const b of ['pen', 'pencil', 'marker', 'highlighter', 'eraser'] as const)
			expect(strokePaint(line(b)).d.startsWith('M')).toBe(true);
	});

	it('pressure changes the pen outline; a tap is a dot', () => {
		const light = strokePaint(line('pen', 10, [0, 0, 0.1, 50, 0, 0.1, 100, 0, 0.1])).d;
		const heavy = strokePaint(line('pen', 10, [0, 0, 0.9, 50, 0, 0.9, 100, 0, 0.9])).d;
		expect(light).not.toBe(heavy);
		expect(strokePaint(line('pen', 10, [5, 5, 0.5])).d).toMatch(/^M.*Z$/); // a closed dot
		expect(strokePaint(line('marker', 10, [5, 5, 0.5])).d).toContain('l0.01,0');
	});

	it('bounds include the width; hit testing follows the line', () => {
		expect(strokeBounds(line('marker'))).toEqual({ x: -5, y: -5, w: 110, h: 10 });
		expect(strokeWidth(line('highlighter'))).toBe(25);
		expect(strokeHit(line('marker'), { x: 50, y: 4 }, 0)).toBe(true);
		expect(strokeHit(line('marker'), { x: 50, y: 9 }, 0)).toBe(false);
		expect(strokeHit(line('marker'), { x: 50, y: 9 }, 5)).toBe(true);
		expect(strokeHit(line('eraser'), { x: 50, y: 0 }, 5)).toBe(false);
	});

	it('validates stored strokes', () => {
		expect(parseStroke(line('pen'))).toEqual(line('pen'));
		expect(parseStroke({ ...line('pen'), b: 'spray' })).toBeNull();
		expect(parseStroke({ ...line('pen'), p: [1, 2] })).toBeNull();
		expect(parseStroke({ ...line('pen'), s: 0 })).toBeNull();
		expect(parseStroke({ ...line('pen'), p: [1, 2, NaN] })).toBeNull();
		expect(parseStroke(null)).toBeNull();
	});
});

describe('sketch frame', () => {
	it('a new sketch frames its first stroke in board coordinates', () => {
		expect(firstFrame(line('marker'))).toEqual({
			x: -5,
			y: -5,
			w: 110,
			h: 10,
			bx: -5,
			by: -5,
			nw: 110,
			nh: 10
		});
	});

	it('grows to include a new stroke without moving what is already drawn', () => {
		const frame = firstFrame(line('marker'));
		const below = line('marker', 10, [0, 100, 0.5, 100, 100, 0.5]);
		const grown = growFrame(frame, below)!;
		expect(grown).toEqual({ x: -5, y: -5, w: 110, h: 110, bx: -5, by: -5, nw: 110, nh: 110 });
		expect(growFrame(grown, line('marker'))).toBeNull(); // already inside
		// A point of the first stroke is at the same board position before and after.
		const before = worldToSketch(frame, { x: 50, y: 0 });
		const after = worldToSketch(grown, { x: 50, y: 0 });
		expect(after).toEqual(before);
	});

	it('works on a moved and resized sketch', () => {
		// Shown rectangle 100×50 of sketch space, drawn twice as large at (1000, 500).
		const el = { x: 1000, y: 500, w: 200, h: 100, bx: 0, by: 0, nw: 100, nh: 50 };
		expect(worldToSketch(el, { x: 1100, y: 550 })).toEqual({ x: 50, y: 25 });
		expect(pointsToSketch(el, [1100, 550, 0.7])).toEqual([50, 25, 0.7]);
		const left = line('marker', 10, [-45, 25, 0.5, 0, 25, 0.5]);
		const grown = growFrame(el, left)!;
		// 50 sketch units further left = 100 board units.
		expect(grown).toMatchObject({ bx: -50, nw: 150, x: 900, w: 300, y: 500, h: 100 });
		expect(
			sketchHit(el, [line('marker', 10, [0, 25, 0.5, 100, 25, 0.5])], { x: 1100, y: 552 }, 0)
		).toBe(true);
		expect(
			sketchHit(el, [line('marker', 10, [0, 25, 0.5, 100, 25, 0.5])], { x: 1100, y: 580 }, 2)
		).toBe(false);
	});
});

describe('pressure and bounds', () => {
	it('bounds of pressure brushes leave room for full pressure', () => {
		// Pen, size 10, thinning 0.6: up to 8 from the center line.
		expect(strokeReach(line('pen'))).toBe(8);
		expect(strokeBounds(line('pen'))).toEqual({ x: -8, y: -8, w: 116, h: 16 });
		expect(strokeReach(line('marker'))).toBe(5);
	});
});
