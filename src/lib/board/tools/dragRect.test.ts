import { describe, expect, it } from 'vitest';
import { dragRect } from './dragRect';

const s = { x: 100, y: 100 };

describe('dragRect', () => {
	it('normalizes drags in every direction', () => {
		expect(dragRect(s, { x: 150, y: 130 })).toEqual({ x: 100, y: 100, w: 50, h: 30 });
		expect(dragRect(s, { x: 60, y: 70 })).toEqual({ x: 60, y: 70, w: 40, h: 30 });
		expect(dragRect(s, { x: 60, y: 130 })).toEqual({ x: 60, y: 100, w: 40, h: 30 });
	});

	it('keeps a square with Shift, following the drag direction', () => {
		expect(dragRect(s, { x: 150, y: 110 }, { square: true })).toEqual({
			x: 100,
			y: 100,
			w: 50,
			h: 50
		});
		expect(dragRect(s, { x: 90, y: 40 }, { square: true })).toEqual({ x: 40, y: 40, w: 60, h: 60 });
	});

	it('grows from the center with Alt', () => {
		expect(dragRect(s, { x: 130, y: 120 }, { fromCenter: true })).toEqual({
			x: 70,
			y: 80,
			w: 60,
			h: 40
		});
		expect(dragRect(s, { x: 130, y: 120 }, { fromCenter: true, square: true })).toEqual({
			x: 70,
			y: 70,
			w: 60,
			h: 60
		});
	});

	it('enforces a minimum size', () => {
		expect(dragRect(s, s)).toEqual({ x: 100, y: 100, w: 1, h: 1 });
		expect(dragRect(s, { x: 101, y: 100 }, { minSize: 8 })).toMatchObject({ w: 8, h: 8 });
	});
});
