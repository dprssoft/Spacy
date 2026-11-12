import { describe, expect, it } from 'vitest';
import { snapMoveEqual } from './gapSnapping';

const box = (x: number, y: number, w = 40, h = 40) => ({ x, y, w, h });

describe('equal spacing snapping', () => {
	it('centers a box between two neighbours in its row', () => {
		// a ends at 40, b starts at 200: a 40-wide box fits midway at x = 100.
		const r = snapMoveEqual(box(103, 300), [box(0, 290), box(200, 310)], 6);
		expect(r.dx).toBe(-3);
		expect(r.snappedX).toBe(true);
		expect(r.gaps).toEqual([
			{ axis: 'x', from: 40, to: 100, at: 315 },
			{ axis: 'x', from: 140, to: 200, at: 325 }
		]);
	});

	it('repeats a gap that is already in the row, on either side', () => {
		const row = [box(0, 0), box(60, 0)]; // gap 20
		const after = snapMoveEqual(box(123, 5), row, 6);
		expect(after.dx).toBe(-3); // x 120: gap 20 after the second box
		expect(after.gaps.map((g) => [g.from, g.to])).toEqual([
			[40, 60],
			[100, 120]
		]);
		const before = snapMoveEqual(box(-58, 5), row, 6);
		expect(before.dx).toBe(-2); // x −60: gap 20 before the first box
		expect(before.gaps).toHaveLength(2);
	});

	it('works vertically too', () => {
		const column = [box(0, 0), box(0, 70)]; // gap 30
		const r = snapMoveEqual(box(10, 142), column, 6);
		expect(r.dy).toBe(-2); // y 140
		expect(r.gaps.every((g) => g.axis === 'y')).toBe(true);
		expect(r.gaps.map((g) => [g.from, g.to])).toEqual([
			[40, 70],
			[110, 140]
		]);
	});

	it('ignores boxes that are not in the same row', () => {
		// The pair far below has a gap of 20, but it doesn't share the mover's row.
		const r = snapMoveEqual(box(123, 500), [box(0, 0), box(60, 0), box(103, 500 - 100)], 6);
		expect(r.gaps).toEqual([]);
	});

	it('the smaller correction wins between an edge and a gap', () => {
		// Gap 20 → x 120 (−4); the edge x 125 of a box above is only +1 away.
		const r = snapMoveEqual(box(124, 5), [box(0, 0), box(60, 0), box(125, -200)], 6);
		expect(r.dx).toBe(1);
		expect(r.gaps).toEqual([]);
		expect(r.guides.some((g) => g.axis === 'x')).toBe(true);
	});

	it('does nothing beyond the threshold', () => {
		const r = snapMoveEqual(box(140, 5), [box(0, 0), box(60, 0)], 6);
		expect(r).toMatchObject({ dx: 0, snappedX: false, gaps: [] });
	});

	it('a gap with another box in between does not count', () => {
		// a … c … b in one row: only a→c and c→b are gaps, not a→b.
		const r = snapMoveEqual(box(297, 0), [box(0, 0), box(100, 0), box(200, 0)], 6);
		expect(r.dx).toBe(3); // gap 60 → x 300
		expect(r.gaps).toHaveLength(3);
	});
});

describe('equal spacing inside a frame', () => {
	// A column frame with cards 10 apart.
	const frame = { x: 0, y: 100, w: 200, h: 700 };
	const cards = [box(20, 120, 160, 60), box(20, 190, 160, 60), box(20, 260, 160, 60)];

	it('a frame around the cards does not break the gaps between them', () => {
		const r = snapMoveEqual(box(20, 333, 160, 60), [frame, ...cards], 6);
		expect(r.dy).toBe(-3); // y 330: the cards' gap of 10
		expect(r.gaps).toHaveLength(3);
	});

	it('only siblings set the spacing', () => {
		// A board title and a column label 20 apart, above the frame (like a kanban board).
		const title = box(0, 0, 100, 40);
		const label = box(0, 60, 100, 30);
		const all = [frame, title, label, ...cards];
		const near = box(20, 342, 160, 60); // 2 from the title→label gap after the last card
		expect(snapMoveEqual(near, all, 6).dy).toBe(-2);
		const r = snapMoveEqual(near, all, 6, cards);
		expect(r.gaps).toEqual([]);
		expect(r.snappedY).toBe(false);
	});
});
