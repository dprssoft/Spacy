import { z } from '$lib/shared/zod';
import { registerWidgetKind, type WidgetKind } from '../kinds';
import { int, rng } from '../random';
import { easeOut, escapeXml, fitText, n, text } from '../svg';

// A wheel of fortune. A spin stores where the wheel starts and stops and who wins, all drawn from
// one seed when it starts, so every tab and peer sees the same turn land on the same segment.

export const WHEEL_COLORS = [
	'#74c0fc',
	'#ff8787',
	'#ffd43b',
	'#8ce99a',
	'#e599f7',
	'#ffa94d',
	'#63e6be',
	'#91a7ff'
] as const;
export const MAX_SEGMENTS = 60;

const segmentSchema = z.object({ label: z.string().max(60), color: z.string().max(32) });
const configSchema = z.object({
	segments: z.array(segmentSchema).min(2).max(MAX_SEGMENTS),
	removeWinner: z.boolean(),
	duration: z.number().min(2).max(10) // seconds
});
const spinSchema = z.object({
	seed: z.number(),
	at: z.number(),
	winner: z.number().int().min(0),
	/** Rotation in degrees (clockwise) at the start and the end of the turn. */
	from: z.number(),
	end: z.number(),
	duration: z.number().min(0)
});
const stateSchema = z.object({
	spin: spinSchema.nullable(),
	/** Segments already won (with "remove the winner"): left out of the next spins. */
	removed: z.array(z.number().int().min(0)),
	history: z.array(z.string()).max(10)
});

export type Segment = z.infer<typeof segmentSchema>;
export type WheelConfig = z.infer<typeof configSchema>;
export type WheelState = z.infer<typeof stateSchema>;
export type Spin = z.infer<typeof spinSchema>;

export const segmentsFrom = (labels: readonly string[]): Segment[] =>
	labels.slice(0, MAX_SEGMENTS).map((label, i) => ({
		label: label.slice(0, 60),
		color: WHEEL_COLORS[i % WHEEL_COLORS.length]!
	}));

export const DEFAULT_WHEEL: WheelConfig = {
	segments: segmentsFrom(['Option 1', 'Option 2', 'Option 3', 'Option 4', 'Option 5', 'Option 6']),
	removeWinner: false,
	duration: 4
};
const IDLE: WheelState = { spin: null, removed: [], history: [] };
const FINISH_WINDOW_MS = 2000;
const ACCENT = '#1971c2';

const endOf = (s: Spin) => s.at + s.duration * 1000;
export const spinning = (s: WheelState, now: number): boolean => !!s.spin && now < endOf(s.spin);
const mod = (a: number, m: number) => ((a % m) + m) % m;

/** Segments that can still win (after `removed`). */
export const available = (c: WheelConfig, removed: readonly number[]): number[] =>
	c.segments.map((_, i) => i).filter((i) => !removed.includes(i));

/** The segment under the pointer (at the top) for a rotation in degrees. */
export function segmentAt(count: number, rotation: number): number {
	return Math.floor(mod(-rotation, 360) / (360 / count)) % count;
}

/** Rotation at `now`; with `motion` off the wheel stays put until the turn is over. */
export function rotationAt(s: WheelState, now: number, motion = true): number {
	const spin = s.spin;
	if (!spin) return 0;
	const p = spin.duration > 0 ? (now - spin.at) / (spin.duration * 1000) : 1;
	if (p >= 1) return spin.end;
	if (!motion || p <= 0) return spin.from;
	return spin.from + (spin.end - spin.from) * easeOut(p);
}

/** Starts a turn: draws the winner among the segments still in, and where to stop. */
export function startSpin(
	c: WheelConfig,
	s: WheelState,
	now: number,
	seed: number
): WheelState | null {
	if (spinning(s, now)) return null;
	const prev = s.spin;
	const removed =
		c.removeWinner && prev && prev.winner < c.segments.length && !s.removed.includes(prev.winner)
			? [...s.removed, prev.winner]
			: s.removed;
	const pool = available(c, removed);
	if (pool.length < 2) return null;
	const r = rng(seed);
	const winner = pool[int(r, pool.length)]!;
	const size = 360 / c.segments.length;
	// Somewhere inside the segment, never on its edge.
	const target = (winner + 0.5 + (r() - 0.5) * 0.7) * size;
	const turns = 4 + int(r, 3);
	const from = prev ? mod(prev.end, 360) : 0;
	const end = from + turns * 360 + mod(-target - from, 360);
	return {
		spin: { seed, at: now, winner, from, end, duration: c.duration },
		removed,
		history: [c.segments[winner]!.label, ...s.history].slice(0, 10)
	};
}

const winnerOf = (c: WheelConfig, s: WheelState, now: number): string | null =>
	s.spin && !spinning(s, now) ? (c.segments[s.spin.winner]?.label ?? null) : null;

const display = (label: string) => label.trim() || '—';

// Design space 280 × 336: the wheel (centre 140, 146; radius 120), the result line, the buttons.
const CX = 140;
const CY = 146;
const R = 120;

function point(deg: number, r: number) {
	const a = (deg * Math.PI) / 180;
	return { x: CX + r * Math.sin(a), y: CY - r * Math.cos(a) };
}

function wheelArt(c: WheelConfig, s: WheelState, now: number, motion: boolean, ink: string) {
	const count = c.segments.length;
	const size = 360 / count;
	const done = !!s.spin && !spinning(s, now);
	const fontSize = Math.max(8, Math.min(14, ((size * Math.PI) / 180) * R * 0.45));
	const rotation = rotationAt(s, now, motion);
	let wedges = '';
	c.segments.forEach((seg, i) => {
		const a0 = i * size;
		const p0 = point(a0, R);
		const p1 = point(a0 + size, R);
		const out = s.removed.includes(i);
		const won = done && s.spin?.winner === i;
		wedges += `<path d="M${CX} ${CY} L${n(p0.x)} ${n(p0.y)} A${R} ${R} 0 ${size > 180 ? 1 : 0} 1 ${n(p1.x)} ${n(p1.y)} Z" fill="${escapeXml(out ? '#e9ecef' : seg.color)}" stroke="${won ? ink : '#ffffff'}" stroke-width="${won ? 3 : 1.5}"/>`;
		const label = fitText(display(seg.label), fontSize, R * 0.7);
		const mid = a0 + size / 2;
		// Labels read outward on the right of the screen and inward on the left, never upside down.
		const flip = mod(mid + rotation, 360) > 180;
		const fill = out ? '#adb5bd' : '#1e1e1e';
		wedges += flip
			? `<g transform="rotate(${n(mid + 90)} ${CX} ${CY})">${text(CX - R + 10, CY + fontSize * 0.35, label, fontSize, fill, 'font-weight="500"')}</g>`
			: `<g transform="rotate(${n(mid - 90)} ${CX} ${CY})">${text(CX + R - 10, CY + fontSize * 0.35, label, fontSize, fill, 'text-anchor="end" font-weight="500"')}</g>`;
	});
	const winner = winnerOf(c, s, now);
	const line = winner
		? text(
				CX,
				286,
				fitText(display(winner), 16, 250),
				16,
				ACCENT,
				'text-anchor="middle" font-weight="700"'
			)
		: s.spin
			? text(CX, 286, 'Spinning…', 14, '#868e96', 'text-anchor="middle"')
			: '';
	return (
		`<g transform="rotate(${n(rotation)} ${CX} ${CY})">${wedges}</g>` +
		`<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${ink}" stroke-width="2"/>` +
		`<circle cx="${CX}" cy="${CY}" r="12" fill="#ffffff" stroke="${ink}" stroke-width="2"/>` +
		`<path d="M128 14 L152 14 L140 38 Z" fill="${ink}" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>` +
		line
	);
}

export const wheelKind: WidgetKind<WheelConfig, WheelState> = {
	kind: 'wheel',
	label: 'Wheel of fortune',
	group: 'Facilitation',
	design: { w: 280, h: 336 },
	parseConfig: (raw) => configSchema.catch(DEFAULT_WHEEL).parse(raw),
	parseState: (raw) => stateSchema.catch(IDLE).parse(raw),
	defaultConfig: () => structuredClone(DEFAULT_WHEEL),
	defaultState: () => structuredClone(IDLE),
	face(c, s, now, title) {
		return {
			headline: winnerOf(c, s, now) ?? 'Wheel',
			caption: title || 'Wheel of fortune',
			ring: null,
			accent: ACCENT
		};
	},
	art: (c, s, now, { motion, ink }) => wheelArt(c, s, now, motion, ink),
	actions(c, s, now) {
		const pending =
			c.removeWinner && s.spin && !spinning(s, now) ? [...s.removed, s.spin.winner] : s.removed;
		return [
			{
				id: 'spin',
				label: 'Spin',
				glyph: { text: 'Spin' },
				rect: { x: 70, y: 296, w: 140, h: 36 },
				primary: true,
				disabled: spinning(s, now) || available(c, pending).length < 2
			},
			{
				id: 'reset',
				label: 'Bring back all segments',
				glyph: 'reset',
				rect: { x: 218, y: 296, w: 44, h: 36 },
				disabled: spinning(s, now) || (!s.spin && s.removed.length === 0)
			}
		];
	},
	perform(action, c, s, now, seed) {
		if (action === 'spin') {
			const state = startSpin(c, s, now, seed);
			return state && { state };
		}
		if (action === 'reset' && !spinning(s, now)) return { state: structuredClone(IDLE) };
		return null;
	},
	ticking: (_c, s, now) => spinning(s, now),
	finished(c, s, now) {
		if (!s.spin) return null;
		const end = endOf(s.spin);
		if (now < end || now - end > FINISH_WINDOW_MS) return null;
		const label = c.segments[s.spin.winner]?.label ?? '';
		return { key: String(s.spin.at), sound: false, message: `Wheel: ${display(label)}` };
	}
};

registerWidgetKind(wheelKind);
