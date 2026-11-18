import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	daysUntil,
	deadlineKind,
	dueAt,
	formatDeadline,
	readDeadline,
	TONE_COLORS
} from './deadline';

// A zone with DST (Berlin: clocks go back on 25 Oct 2026, forward on 29 Mar 2026).
const previousTz = process.env.TZ;
beforeAll(() => {
	process.env.TZ = 'Europe/Berlin';
});
afterAll(() => {
	process.env.TZ = previousTz;
});

const at = (y: number, m: number, d: number, h = 12, min = 0) =>
	new Date(y, m - 1, d, h, min).getTime();
const cfg = (date: string, time: string | null = null) => ({ date, time, label: '' });

describe('deadline', () => {
	it('counts calendar days across a DST change', () => {
		// 24 Oct to 26 Oct is 47 hours of wall time here, but two days.
		expect(daysUntil('2026-10-26', at(2026, 10, 24, 0, 30))).toBe(2);
		expect(daysUntil('2026-03-30', at(2026, 3, 28, 23, 30))).toBe(2);
		expect(readDeadline(cfg('2026-10-26'), at(2026, 10, 24, 23, 59)).text).toBe('In 2 days');
	});

	it('changes at midnight, not 24 hours after the last look', () => {
		expect(readDeadline(cfg('2026-11-20'), at(2026, 11, 19, 23, 59)).text).toBe('Tomorrow');
		expect(readDeadline(cfg('2026-11-20'), at(2026, 11, 20, 0, 0)).text).toBe('Today');
		// Without a time it's due at the end of its day.
		expect(readDeadline(cfg('2026-11-20'), at(2026, 11, 20, 23, 59)).text).toBe('Today');
		expect(readDeadline(cfg('2026-11-20'), at(2026, 11, 21, 0, 0)).text).toBe('1 day overdue');
		expect(readDeadline(cfg('2026-11-20'), at(2026, 11, 23, 9)).text).toBe('3 days overdue');
	});

	it('is overdue the same day once its time has passed', () => {
		const c = cfg('2026-11-20', '17:00');
		expect(dueAt(c)).toBe(at(2026, 11, 20, 17));
		expect(readDeadline(c, at(2026, 11, 20, 16, 59)).text).toBe('Today');
		expect(readDeadline(c, at(2026, 11, 20, 17, 1))).toEqual({ text: 'Overdue', tone: 'overdue' });
	});

	it('turns amber at two days and red when overdue', () => {
		const c = cfg('2026-11-20');
		expect(readDeadline(c, at(2026, 11, 17)).tone).toBe('neutral');
		expect(readDeadline(c, at(2026, 11, 18)).tone).toBe('soon');
		expect(readDeadline(c, at(2026, 11, 20)).tone).toBe('soon');
		expect(readDeadline(c, at(2026, 11, 21)).tone).toBe('overdue');
		expect(deadlineKind.face(c, null, at(2026, 11, 18), '').accent).toBe(TONE_COLORS.soon);
		expect(deadlineKind.face(c, null, at(2026, 11, 22), '').accent).toBe(TONE_COLORS.overdue);
	});

	it('shows the date, and falls back to a week from now on bad data', () => {
		expect(formatDeadline(cfg('2026-11-20', '09:30'))).toBe('Fri 20 Nov 2026 · 09:30');
		expect(deadlineKind.parseConfig({ date: '2026-02-30', time: null, label: '' }).date).not.toBe(
			'2026-02-30'
		);
		expect(deadlineKind.parseConfig(cfg('2026-11-20', '25:00')).time).not.toBe('25:00');
		expect(deadlineKind.refreshMs?.(cfg('2026-11-20'))).toBe(60_000);
	});
});

describe('deadline art', () => {
	it('shrinks a long headline instead of cutting it', () => {
		for (const late of [17, 2513]) {
			const now = new Date(2026, 10, 20 + late, 12).getTime();
			const art = deadlineKind.art!({ date: '2026-11-20', time: null, label: '' }, null, now, {
				motion: true,
				ink: '#1e1e1e',
				title: ''
			});
			expect(art).toContain(`${late} days overdue`);
			expect(art).not.toContain('…');
		}
	});
});
