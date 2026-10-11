import { describe, expect, it } from 'vitest';
import { formatClock, readTimer, timerAction, timerKind, type TimerConfig } from './timer';

const c: TimerConfig = { mode: 'countdown', duration: 300, sound: true };
const fresh = { startedAt: null, elapsed: 0 };

describe('timer', () => {
	it('formats the time', () => {
		expect(formatClock(0)).toBe('0:00');
		expect(formatClock(65_000)).toBe('1:05');
		expect(formatClock(12 * 60_000)).toBe('12:00');
		expect(formatClock(3_723_000)).toBe('1:02:03');
	});

	it('starts, pauses and resumes', () => {
		const started = timerAction('toggle', c, fresh, 1000)!.state!;
		expect(started).toEqual({ startedAt: 1000, elapsed: 0 });
		expect(readTimer(c, started, 61_000).remaining).toBe(240_000);
		const paused = timerAction('toggle', c, started, 61_000)!.state!;
		expect(paused).toEqual({ startedAt: null, elapsed: 60_000 });
		expect(readTimer(c, paused, 999_999).remaining).toBe(240_000);
		const resumed = timerAction('toggle', c, paused, 100_000)!.state!;
		expect(readTimer(c, resumed, 110_000).remaining).toBe(230_000);
	});

	it('a countdown stops at 0 and is done; toggling restarts it', () => {
		const s = { startedAt: 0, elapsed: 0 };
		const r = readTimer(c, s, 400_000);
		expect(r).toMatchObject({ remaining: 0, done: true, endsAt: 300_000 });
		expect(timerKind.ticking(c, s, 400_000)).toBe(false);
		expect(timerKind.face(c, s, 400_000, '')).toMatchObject({ caption: "Time's up", alert: true });
		expect(timerAction('toggle', c, s, 400_000)!.state).toEqual({ startedAt: 400_000, elapsed: 0 });
	});

	it('a stopwatch counts up', () => {
		const sw: TimerConfig = { ...c, mode: 'stopwatch' };
		const s = { startedAt: 0, elapsed: 5000 };
		expect(readTimer(sw, s, 10_000).total).toBe(15_000);
		expect(readTimer(sw, s, 10_000).done).toBe(false);
		expect(timerKind.face(sw, s, 10_000, 'Talk').headline).toBe('0:15');
		expect(timerAction('plus', sw, s, 10_000)).toBeNull();
	});

	it('±1 min changes the duration before the first start, the time left after', () => {
		expect(timerAction('plus', c, fresh, 0)!.config!.duration).toBe(360);
		expect(timerAction('minus', c, fresh, 0)!.config!.duration).toBe(240);
		expect(timerAction('minus', { ...c, duration: 30 }, fresh, 0)!.config!.duration).toBe(1);
		expect(timerAction('minus', { ...c, duration: 1 }, fresh, 0)).toBeNull();

		const running = { startedAt: 0, elapsed: 0 };
		const plus = timerAction('plus', c, running, 100_000)!.state!;
		expect(readTimer(c, plus, 100_000).remaining).toBe(260_000);
		expect(readTimer(c, plus, 110_000).remaining).toBe(250_000);
		const minus = timerAction('minus', c, running, 100_000)!.state!;
		expect(readTimer(c, minus, 100_000).remaining).toBe(140_000);
		// Past the end: one more minute from 0.
		const over = timerAction('plus', c, running, 999_000)!.state!;
		expect(readTimer(c, over, 999_000).remaining).toBe(60_000);
	});

	it('reset goes back to the start (nothing to do when fresh)', () => {
		expect(timerAction('reset', c, { startedAt: 5, elapsed: 7 }, 10)!.state).toEqual(fresh);
		expect(timerAction('reset', c, fresh, 10)).toBeNull();
	});

	it('reports a finish only just after it happens', () => {
		const s = { startedAt: 0, elapsed: 0 };
		expect(timerKind.finished!(c, s, 299_999)).toBeNull();
		expect(timerKind.finished!(c, s, 300_050)).toEqual({
			key: '300000',
			sound: true,
			message: "Time's up"
		});
		expect(timerKind.finished!(c, s, 310_000)).toBeNull();
		expect(timerKind.finished!(c, fresh, 310_000)).toBeNull();
	});

	it('reads bad data as defaults', () => {
		expect(timerKind.parseConfig({ mode: 'egg', duration: -1 })).toEqual(c);
		expect(timerKind.parseState(null)).toEqual(fresh);
		expect(timerKind.parseConfig({ ...c, duration: 90 }).duration).toBe(90);
	});

	it('offers start, pause and resume as the primary action', () => {
		const label = (s: typeof fresh | { startedAt: number; elapsed: number }, now = 0) =>
			timerKind.actions(c, s, now).find((a) => a.primary)!.label;
		expect(label(fresh)).toBe('Start');
		expect(label({ startedAt: 0, elapsed: 0 }, 10)).toBe('Pause');
		expect(label({ startedAt: null, elapsed: 10 })).toBe('Resume');
		expect(label({ startedAt: 0, elapsed: 0 }, 400_000)).toBe('Restart');
		expect(timerKind.actions({ ...c, mode: 'stopwatch' }, fresh, 0).map((a) => a.id)).toEqual([
			'reset',
			'toggle'
		]);
	});
});
