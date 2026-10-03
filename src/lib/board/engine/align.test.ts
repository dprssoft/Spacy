import { describe, expect, it } from 'vitest';
import { align, distribute, matchSize, stackInFrame, STACK_GAP, STACK_PADDING } from './align';
import { snapMove, snapPoint, snapToGrid } from './snapping';

const items = [
	{ id: 'a', box: { x: 0, y: 0, w: 100, h: 50 } },
	{ id: 'b', box: { x: 150, y: 40, w: 50, h: 100 } },
	{ id: 'c', box: { x: 400, y: 10, w: 20, h: 20 } }
];
const after = (shifts: { id: string; dx: number; dy: number }[]) =>
	Object.fromEntries(
		shifts.map((s) => {
			const b = items.find((i) => i.id === s.id)!.box;
			return [s.id, { x: b.x + s.dx, y: b.y + s.dy, w: b.w, h: b.h }];
		})
	);

describe('align', () => {
	it('aligns edges and centers to the selection bounds', () => {
		expect(Object.values(after(align(items, 'left'))).map((r) => r.x)).toEqual([0, 0, 0]);
		expect(Object.values(after(align(items, 'right'))).map((r) => r.x + r.w)).toEqual([
			420, 420, 420
		]);
		expect(Object.values(after(align(items, 'hcenter'))).map((r) => r.x + r.w / 2)).toEqual([
			210, 210, 210
		]);
		expect(Object.values(after(align(items, 'top'))).map((r) => r.y)).toEqual([0, 0, 0]);
		expect(Object.values(after(align(items, 'bottom'))).map((r) => r.y + r.h)).toEqual([
			140, 140, 140
		]);
		expect(Object.values(after(align(items, 'vcenter'))).map((r) => r.y + r.h / 2)).toEqual([
			70, 70, 70
		]);
	});

	it('needs at least two items', () => {
		expect(align([items[0]!], 'left')).toEqual([]);
	});
});

describe('distribute', () => {
	it('makes equal gaps with different sizes, keeping the outermost items', () => {
		const r = after(distribute(items, 'h'));
		// span 0..420, sizes 100+50+20 = 170 → gaps of 125
		expect(r.a!.x).toBe(0);
		expect(r.b!.x).toBe(225);
		expect(r.c!.x).toBe(400);
		expect(r.b!.x - (r.a!.x + 100)).toBeCloseTo(r.c!.x - (r.b!.x + 50));
	});

	it('works vertically and needs three items', () => {
		const r = after(distribute(items, 'v'));
		expect(r.a!.y).toBe(0);
		expect(r.b!.y).toBe(40); // bottom-most (ends at 140) stays
		expect(distribute(items.slice(0, 2), 'h')).toEqual([]);
	});
});

describe('matchSize', () => {
	it('matches the largest width and/or height', () => {
		const s = [
			{ id: 'a', w: 100, h: 50 },
			{ id: 'b', w: 40, h: 80 }
		];
		expect(matchSize(s, 'w')).toEqual([
			{ id: 'a', w: 100, h: 50 },
			{ id: 'b', w: 100, h: 80 }
		]);
		expect(matchSize(s, 'both').every((r) => r.w === 100 && r.h === 80)).toBe(true);
	});
});

describe('snapping', () => {
	const others = [{ x: 200, y: 100, w: 100, h: 50 }];

	it('snaps a moving box to the nearest line within the threshold', () => {
		const r = snapMove({ x: 197, y: 300, w: 40, h: 40 }, others, 6);
		expect(r.dx).toBe(3); // left edge → 200
		expect(r.dy).toBe(0);
		expect(r.guides).toEqual([{ axis: 'x', at: 200, from: 100, to: 340 }]);
	});

	it('snaps centers and each axis independently', () => {
		const r = snapMove({ x: 228, y: 104, w: 40, h: 40 }, others, 6);
		expect(r.dx).toBe(2); // center 248 → 250
		expect(r.dy).toBe(1); // center 124 → 125
		expect(r.guides.map((g) => g.axis).sort()).toEqual(['x', 'y']);
	});

	it('does not snap beyond the threshold', () => {
		expect(snapMove({ x: 150, y: 300, w: 40, h: 40 }, others, 6)).toEqual({
			dx: 0,
			dy: 0,
			guides: []
		});
	});

	it('snaps points (dragged corners)', () => {
		const r = snapPoint({ x: 298, y: 152 }, others, 6);
		expect(r.point).toEqual({ x: 300, y: 150 });
		expect(r.snappedX && r.snappedY).toBe(true);
		expect(snapPoint({ x: 0, y: 0 }, others, 6).guides).toEqual([]);
	});

	it('snaps to a grid', () => {
		expect(snapToGrid(37, 24)).toBe(48);
		expect(snapToGrid(-13, 24)).toBe(-24);
		expect(snapToGrid(11, 24)).toBe(0);
	});
});

describe('stackInFrame', () => {
	const frame = { x: 100, y: 100, w: 300, h: 400 };
	it('stacks in reading order at the padding, a gap apart, keeping sizes', () => {
		const items = [
			{ id: 'low', box: { x: 250, y: 300, w: 100, h: 60 } },
			{ id: 'top', box: { x: 180, y: 120, w: 120, h: 80 } },
			{ id: 'topRight', box: { x: 300, y: 120, w: 50, h: 50 } }
		];
		const { shifts, frameH } = stackInFrame(frame, items);
		expect(shifts.map((s) => s.id)).toEqual(['top', 'topRight', 'low']);
		const placed = shifts.map((s) => {
			const b = items.find((i) => i.id === s.id)!.box;
			return { x: b.x + s.dx, y: b.y + s.dy };
		});
		const p = STACK_PADDING;
		const g = STACK_GAP;
		expect(placed).toEqual([
			{ x: 100 + p, y: 100 + p },
			{ x: 100 + p, y: 100 + p + 80 + g },
			{ x: 100 + p, y: 100 + p + 80 + g + 50 + g }
		]);
		expect(frameH).toBe(400);
	});

	it('grows the frame when the stack is taller, and handles no items', () => {
		const tall = Array.from({ length: 5 }, (_, i) => ({
			id: `s${i}`,
			box: { x: 0, y: i, w: 50, h: 100 }
		}));
		expect(stackInFrame(frame, tall).frameH).toBe(STACK_PADDING * 2 + 5 * 100 + 4 * STACK_GAP);
		expect(stackInFrame(frame, [])).toEqual({ shifts: [], frameH: 400 });
	});
});
