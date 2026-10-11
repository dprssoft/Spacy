import { z } from '$lib/shared/zod';
import { registerWidgetKind, type WidgetAction, type WidgetKind } from '../kinds';

// A countdown or stopwatch. State is absolute (when it started, how much ran before), so every
// tab and peer derives the same time from its own clock.

const configSchema = z.object({
	mode: z.enum(['countdown', 'stopwatch']),
	duration: z.number().int().min(1).max(86_400), // seconds
	sound: z.boolean()
});
const stateSchema = z.object({
	startedAt: z.number().nullable(),
	/** Milliseconds run before `startedAt` (negative after adding time to a running countdown). */
	elapsed: z.number()
});

export type TimerConfig = z.infer<typeof configSchema>;
export type TimerState = z.infer<typeof stateSchema>;

export const DEFAULT_TIMER: TimerConfig = { mode: 'countdown', duration: 300, sound: true };
const FRESH: TimerState = { startedAt: null, elapsed: 0 };
export const TIMER_PRESETS_MIN = [1, 3, 5, 10, 15, 25] as const;
const MINUTE = 60_000;
const WARN_MS = 10_000;
/** A tab that sees the end later than this (opened afterwards) stays quiet. */
const FINISH_WINDOW_MS = 2000;
const BLUE = '#1971c2';
const RED = '#e03131';

export interface TimerReading {
	running: boolean;
	/** Milliseconds run so far (all runs since the last reset). */
	total: number;
	/** Countdowns: milliseconds left, ≥ 0. */
	remaining: number;
	done: boolean;
	/** When a running countdown reaches 0 (epoch ms), else null. */
	endsAt: number | null;
}

export function readTimer(c: TimerConfig, s: TimerState, now: number): TimerReading {
	const running = s.startedAt !== null;
	const total = s.elapsed + (s.startedAt !== null ? now - s.startedAt : 0);
	const remaining = Math.max(0, c.duration * 1000 - total);
	const countdown = c.mode === 'countdown';
	return {
		running,
		total,
		remaining,
		done: countdown && remaining === 0,
		endsAt: countdown && s.startedAt !== null ? s.startedAt + c.duration * 1000 - s.elapsed : null
	};
}

/** "4:05", "12:00", "1:02:03". */
export function formatClock(ms: number): string {
	const sec = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(sec / 3600);
	const m = Math.floor((sec % 3600) / 60);
	const ss = String(sec % 60).padStart(2, '0');
	return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

const isFresh = (s: TimerState) => s.startedAt === null && s.elapsed === 0;

/** Pure transitions: what an action writes. */
export function timerAction(
	action: string,
	c: TimerConfig,
	s: TimerState,
	now: number
): { config?: TimerConfig; state?: TimerState } | null {
	const r = readTimer(c, s, now);
	const durationMs = c.duration * 1000;
	switch (action) {
		case 'toggle':
			if (r.done) return { state: { startedAt: now, elapsed: 0 } };
			if (r.running)
				return {
					state: {
						startedAt: null,
						elapsed: c.mode === 'countdown' ? Math.min(r.total, durationMs) : r.total
					}
				};
			return { state: { startedAt: now, elapsed: s.elapsed } };
		case 'reset':
			return isFresh(s) ? null : { state: FRESH };
		case 'plus':
		case 'minus': {
			if (c.mode !== 'countdown') return null;
			const sign = action === 'plus' ? 1 : -1;
			if (isFresh(s)) {
				const duration = Math.min(86_400, Math.max(1, c.duration + sign * 60));
				return duration === c.duration ? null : { config: { ...c, duration } };
			}
			const ran = Math.min(r.total, durationMs);
			const total = action === 'plus' ? ran - MINUTE : Math.min(durationMs, ran + MINUTE);
			return { state: { startedAt: r.running ? now : null, elapsed: total } };
		}
	}
	return null;
}

const btn = (x: number, w = 44) => ({ x, y: 192, w, h: 36 });

export const timerKind: WidgetKind<TimerConfig, TimerState> = {
	kind: 'timer',
	label: 'Timer',
	group: 'Facilitation',
	design: { w: 240, h: 240 },
	parseConfig: (raw) => configSchema.catch(DEFAULT_TIMER).parse(raw),
	parseState: (raw) => stateSchema.catch(FRESH).parse(raw),
	defaultConfig: () => ({ ...DEFAULT_TIMER }),
	defaultState: () => ({ ...FRESH }),
	face(c, s, now, title) {
		const r = readTimer(c, s, now);
		if (c.mode === 'stopwatch')
			return {
				headline: formatClock(r.total),
				caption: title || 'Stopwatch',
				ring: (Math.max(0, r.total) % MINUTE) / MINUTE,
				accent: BLUE
			};
		const durationMs = c.duration * 1000;
		return {
			headline: formatClock(Math.ceil(r.remaining / 1000) * 1000),
			caption: r.done ? "Time's up" : title || 'Timer',
			ring: r.remaining / Math.max(durationMs, r.remaining),
			accent: r.done || (r.running && r.remaining <= WARN_MS) ? RED : BLUE,
			alert: r.done
		};
	},
	actions(c, s, now) {
		const r = readTimer(c, s, now);
		const toggle = (x: number): WidgetAction => ({
			id: 'toggle',
			label: r.done ? 'Restart' : r.running ? 'Pause' : r.total > 0 ? 'Resume' : 'Start',
			glyph: r.running && !r.done ? 'pause' : 'play',
			rect: btn(x, 56),
			primary: true
		});
		const reset = (x: number): WidgetAction => ({
			id: 'reset',
			label: 'Reset',
			glyph: 'reset',
			rect: btn(x)
		});
		if (c.mode === 'stopwatch') return [reset(66), toggle(118)];
		return [
			{ id: 'minus', label: 'One minute less', glyph: { text: '−1' }, rect: btn(14) },
			reset(66),
			toggle(118),
			{ id: 'plus', label: 'One minute more', glyph: { text: '+1' }, rect: btn(182) }
		];
	},
	perform: (action, c, s, now) => timerAction(action, c, s, now),
	ticking(c, s, now) {
		const r = readTimer(c, s, now);
		return r.running && !r.done;
	},
	finished(c, s, now) {
		const { endsAt } = readTimer(c, s, now);
		if (endsAt === null || now < endsAt || now - endsAt > FINISH_WINDOW_MS) return null;
		return { key: String(endsAt), sound: c.sound, message: "Time's up" };
	}
};

registerWidgetKind(timerKind);
