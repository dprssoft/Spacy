import { describe, expect, it } from 'vitest';
import {
	DEFAULT_WHEEL,
	rotationAt,
	segmentAt,
	segmentsFrom,
	startSpin,
	wheelKind,
	type WheelConfig,
	type WheelState
} from './wheel';

const idle: WheelState = { spin: null, removed: [], history: [] };
const wheel = (count: number, extra: Partial<WheelConfig> = {}): WheelConfig => ({
	...DEFAULT_WHEEL,
	segments: segmentsFrom(Array.from({ length: count }, (_, i) => `S${i}`)),
	...extra
});

describe('wheel of fortune', () => {
	it.each([2, 7, 60])('stops with the winner under the pointer (%i segments)', (count) => {
		for (let seed = 1; seed < 200; seed += 7) {
			const s = startSpin(wheel(count), idle, 0, seed)!;
			expect(segmentAt(count, rotationAt(s, 10_000))).toBe(s.spin!.winner);
			expect(s.spin!.end - s.spin!.from).toBeGreaterThanOrEqual(4 * 360);
		}
	});

	it('the same seed gives the same winner', () => {
		expect(startSpin(wheel(7), idle, 0, 99)).toEqual(startSpin(wheel(7), idle, 0, 99));
	});

	it('turns smoothly from where the last spin stopped', () => {
		const s = startSpin(wheel(5), idle, 0, 3)!;
		expect(rotationAt(s, 0)).toBe(s.spin!.from);
		const mid = rotationAt(s, 2000);
		expect(mid).toBeGreaterThan(s.spin!.from);
		expect(mid).toBeLessThan(s.spin!.end);
		expect(rotationAt(s, 4000)).toBe(s.spin!.end);
		// Reduced motion: no turning, then the result.
		expect(rotationAt(s, 2000, false)).toBe(s.spin!.from);
		const next = startSpin(wheel(5), s, 5000, 4)!;
		expect(next.spin!.from).toBeCloseTo(((s.spin!.end % 360) + 360) % 360);
	});

	it("can't spin again while turning", () => {
		const s = startSpin(wheel(5), idle, 0, 3)!;
		expect(startSpin(wheel(5), s, 1000, 4)).toBeNull();
		expect(wheelKind.actions(wheel(5), s, 1000)[0]!.disabled).toBe(true);
		expect(wheelKind.ticking(wheel(5), s, 1000)).toBe(true);
		expect(wheelKind.ticking(wheel(5), s, 4000)).toBe(false);
	});

	it('removes winners from later spins until reset, and stops when fewer than two are left', () => {
		const c = wheel(4, { removeWinner: true });
		let s: WheelState = idle;
		const winners: number[] = [];
		for (let i = 0; i < 3; i++) {
			s = startSpin(c, s, i * 10_000, 11 + i)!;
			winners.push(s.spin!.winner);
			expect(s.removed).not.toContain(s.spin!.winner);
		}
		expect(new Set(winners).size).toBe(3);
		// Two removed and one pending: one left, so no more spins.
		expect(startSpin(c, s, 40_000, 20)).toBeNull();
		expect(wheelKind.actions(c, s, 40_000)[0]!.disabled).toBe(true);
		expect(wheelKind.perform('reset', c, s, 40_000, 0)!.state).toEqual(idle);
	});

	it('announces the winner just after it stops', () => {
		const c = wheel(3);
		const s = startSpin(c, idle, 0, 5)!;
		const label = c.segments[s.spin!.winner]!.label;
		expect(wheelKind.finished!(c, s, 3999)).toBeNull();
		expect(wheelKind.finished!(c, s, 4100)?.message).toBe(`Wheel: ${label}`);
		expect(wheelKind.face(c, s, 4100, '').headline).toBe(label);
		expect(wheelKind.finished!(c, s, 9000)).toBeNull();
	});

	it('draws escaped labels and keeps the history short', () => {
		const c = { ...wheel(2), segments: segmentsFrom(['<a>', 'b']) };
		const art = wheelKind.art!(c, idle, 0, { motion: true, ink: '#000', title: '' });
		expect(art).toContain('&#60;a&#62;');
		let s: WheelState = idle;
		for (let i = 0; i < 15; i++) s = startSpin(c, s, i * 10_000, i + 1)!;
		expect(s.history).toHaveLength(10);
	});
});
