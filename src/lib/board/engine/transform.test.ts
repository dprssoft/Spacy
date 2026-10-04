import { describe, expect, it } from 'vitest';
import { samples } from '$lib/model/testFixtures';
import type { Point } from '$lib/model/types';
import { rectCenter, rotatePoint } from './geometry';
import {
	cursorForHandle,
	hitHandle,
	normalizeAngle,
	resizeBox,
	resizeHandlePoint,
	RESIZE_HANDLES,
	rotateElementsAround,
	scaleElementsToBox,
	selectionBox,
	selectionHandles,
	sizePatch,
	snapAngle,
	type Box,
	type ResizeHandle
} from './transform';

const opts = { keepAspect: false, fromCenter: false, minSize: 8 };

/** World position of a box's local point (fx, fy ∈ [0,1]). */
function worldPoint(b: Box, fx: number, fy: number): Point {
	return rotatePoint({ x: b.x + fx * b.w, y: b.y + fy * b.h }, rectCenter(b), b.rotation);
}

const OPPOSITE: Record<ResizeHandle, [number, number]> = {
	nw: [1, 1],
	n: [0.5, 1],
	ne: [0, 1],
	e: [0, 0.5],
	se: [0, 0],
	s: [0.5, 0],
	sw: [1, 0],
	w: [1, 0.5]
};
const HANDLE_AT: Record<ResizeHandle, [number, number]> = {
	nw: [0, 0],
	n: [0.5, 0],
	ne: [1, 0],
	e: [1, 0.5],
	se: [1, 1],
	s: [0.5, 1],
	sw: [0, 1],
	w: [0, 0.5]
};

describe('resizeBox', () => {
	for (const rotation of [0, Math.PI / 6]) {
		const start: Box = { x: 100, y: 50, w: 200, h: 100, rotation };
		it.each(RESIZE_HANDLES)(
			`keeps the opposite point fixed (%s, rotation ${rotation.toFixed(2)})`,
			(h) => {
				const [hx, hy] = HANDLE_AT[h];
				const from = worldPoint(start, hx, hy);
				// Drag the handle 30px outward along the box's own axes.
				const out = rotatePoint(
					{ x: from.x + (hx - 0.5) * 60, y: from.y + (hy - 0.5) * 60 },
					from,
					rotation
				);
				const next = resizeBox(start, h, out, opts);
				const [ox, oy] = OPPOSITE[h];
				const before = worldPoint(start, ox, oy);
				const after = worldPoint(next, ox, oy);
				expect(after.x).toBeCloseTo(before.x, 2);
				expect(after.y).toBeCloseTo(before.y, 2);
				expect(next.rotation).toBe(rotation);
				if (hx !== 0.5) expect(next.w).toBeCloseTo(230, 2);
				else expect(next.w).toBeCloseTo(200, 2);
				if (hy !== 0.5) expect(next.h).toBeCloseTo(130, 2);
				else expect(next.h).toBeCloseTo(100, 2);
			}
		);
	}

	const start: Box = { x: 0, y: 0, w: 200, h: 100, rotation: 0 };

	it('keeps the aspect ratio from a corner, following the larger change', () => {
		const next = resizeBox(start, 'se', { x: 400, y: 120 }, { ...opts, keepAspect: true });
		expect(next).toMatchObject({ x: 0, y: 0, w: 400, h: 200 });
	});

	it('keeps the aspect ratio from a side, centered on the other axis', () => {
		const next = resizeBox(start, 'e', { x: 400, y: 50 }, { ...opts, keepAspect: true });
		expect(next).toMatchObject({ x: 0, w: 400, h: 200, y: -50 });
	});

	it('resizes from the center with Alt', () => {
		const next = resizeBox(start, 'e', { x: 250, y: 50 }, { ...opts, fromCenter: true });
		expect(next).toMatchObject({ x: -50, y: 0, w: 300, h: 100 });
	});

	it('clamps to the minimum size instead of flipping', () => {
		const next = resizeBox(start, 'se', { x: -300, y: -300 }, opts);
		expect(next).toMatchObject({ x: 0, y: 0, w: 8, h: 8 });
		const west = resizeBox(start, 'w', { x: 500, y: 50 }, opts);
		expect(west).toMatchObject({ x: 192, w: 8 });
	});

	it('honours per-axis limits (min size, fixed height)', () => {
		const start: Box = { x: 0, y: 0, w: 300, h: 200, rotation: 0 };
		const opts = { keepAspect: false, fromCenter: false, minSize: 8 };
		const shrunk = resizeBox(
			start,
			'se',
			{ x: 10, y: 10 },
			{ ...opts, limits: { minW: 240, minH: 120 } }
		);
		expect([shrunk.w, shrunk.h]).toEqual([240, 120]);
		const fixed = resizeBox(
			{ ...start, h: 40 },
			'se',
			{ x: 500, y: 400 },
			{
				...opts,
				limits: { minW: 240, minH: 40, maxH: 40 }
			}
		);
		expect([fixed.w, fixed.h]).toEqual([500, 40]);
	});
});

describe('multi-element transforms', () => {
	const a = { ...samples.shape('a'), x: 0, y: 0, w: 100, h: 100 };
	const b = { ...samples.sticky('b'), x: 100, y: 100, w: 100, h: 100 };

	it('frames a single element with its rotation, several with their union', () => {
		const aabb = (el: { x: number; y: number; w: number; h: number }) => el;
		expect(selectionBox([{ ...a, rotation: 1 }], aabb)).toMatchObject({ rotation: 1, w: 100 });
		expect(selectionBox([a, b], aabb)).toEqual({ x: 0, y: 0, w: 200, h: 200, rotation: 0 });
		expect(selectionBox([], aabb)).toBeNull();
	});

	it('scales positions and sizes into the new box', () => {
		const patches = scaleElementsToBox(
			[a, b],
			{ x: 0, y: 0, w: 200, h: 200 },
			{ x: 0, y: 0, w: 400, h: 100 }
		);
		expect(patches).toEqual([
			{ id: 'a', patch: { x: 0, y: 0, w: 200, h: 50 } },
			{ id: 'b', patch: { x: 200, y: 50, w: 200, h: 50 } }
		]);
	});

	it('scales stroke points with the size and skips connectors', () => {
		const stroke = { ...samples.stroke('s'), w: 20, h: 10, points: [0, 0, 0.5, 20, 10, 0.7] };
		expect(sizePatch(stroke, 40, 30)).toEqual({ w: 40, h: 30, points: [0, 0, 0.5, 40, 30, 0.7] });
		const conn = samples.connector('c');
		expect(
			scaleElementsToBox([conn], { x: 0, y: 0, w: 1, h: 1 }, { x: 0, y: 0, w: 2, h: 2 })
		).toEqual([]);
	});

	it('turns off auto-width when a text is resized horizontally', () => {
		const text = { ...samples.text('t'), autoWidth: true };
		expect(sizePatch(text, text.w + 10, text.h)).toMatchObject({ autoWidth: false });
		expect(sizePatch(text, text.w, text.h + 10)).not.toHaveProperty('autoWidth');
	});

	it('rotates around a shared center', () => {
		const [pa, pb] = rotateElementsAround([a, b], { x: 100, y: 100 }, Math.PI / 2);
		// a's center (50,50) → (150,50); b's center (150,150) → (50,150)
		expect(pa!.patch.x).toBeCloseTo(100);
		expect(pa!.patch.y).toBeCloseTo(0);
		expect(pb!.patch.x).toBeCloseTo(0);
		expect(pb!.patch.y).toBeCloseTo(100);
		expect(pa!.patch.rotation).toBeCloseTo(Math.PI / 2);
	});
});

describe('angles', () => {
	it('normalizes to (-π, π]', () => {
		expect(normalizeAngle(Math.PI * 3)).toBeCloseTo(Math.PI);
		expect(normalizeAngle(-Math.PI * 1.5)).toBeCloseTo(Math.PI / 2);
		expect(normalizeAngle(0.3)).toBe(0.3);
	});

	it('snaps to 15° steps', () => {
		expect(snapAngle((20 * Math.PI) / 180)).toBeCloseTo((15 * Math.PI) / 180);
		expect(snapAngle((23 * Math.PI) / 180)).toBeCloseTo((30 * Math.PI) / 180);
		expect(snapAngle(-0.01)).toBeCloseTo(0);
	});
});

describe('handles', () => {
	const box: Box = { x: 0, y: 0, w: 100, h: 50, rotation: 0 };
	const id = (p: Point) => p;

	it('places 8 resize handles and a rotate handle above the top edge', () => {
		const hs = selectionHandles(box, id, { resize: true, rotate: true });
		expect(hs).toHaveLength(9);
		expect(hs.find((h) => h.id === 'se')).toMatchObject({ x: 100, y: 50 });
		expect(hs.find((h) => h.id === 'rotate')).toMatchObject({ x: 50, y: -24 });
		expect(selectionHandles(box, id, { resize: false, rotate: true })).toHaveLength(1);
	});

	it('resize handle points are in world space, rotated with the box', () => {
		expect(resizeHandlePoint(box, 'se')).toEqual({ x: 100, y: 50 });
		expect(resizeHandlePoint(box, 'n')).toEqual({ x: 50, y: 0 });
		const turned = resizeHandlePoint({ ...box, rotation: Math.PI }, 'se');
		expect(turned.x).toBeCloseTo(0);
		expect(turned.y).toBeCloseTo(0);
	});

	it('hit-tests handles within a radius, preferring rotate', () => {
		const hs = selectionHandles(box, id, { resize: true, rotate: true });
		expect(hitHandle(hs, { x: 103, y: 52 }, 6)).toBe('se');
		expect(hitHandle(hs, { x: 50, y: -20 }, 6)).toBe('rotate');
		expect(hitHandle(hs, { x: 30, y: 30 }, 6)).toBeNull();
	});

	it('picks resize cursors that follow rotation', () => {
		expect(cursorForHandle('e', 0)).toBe('ew-resize');
		expect(cursorForHandle('se', 0)).toBe('nwse-resize');
		expect(cursorForHandle('n', 0)).toBe('ns-resize');
		expect(cursorForHandle('ne', 0)).toBe('nesw-resize');
		expect(cursorForHandle('e', Math.PI / 2)).toBe('ns-resize');
		expect(cursorForHandle('e', Math.PI / 4)).toBe('nwse-resize');
	});
});
