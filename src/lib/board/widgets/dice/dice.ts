import { z } from '$lib/shared/zod';
import { registerWidgetKind, type WidgetKind } from '../kinds';
import { int, mix, rng } from '../random';
import { n, text } from '../svg';

// Dice (or coins: two sides). A roll stores its seed and values; the tumble before it settles is
// derived from the seed, so it looks the same everywhere.

export const SIDES = [2, 4, 6, 8, 10, 12, 20] as const;
const configSchema = z.object({
	count: z.number().int().min(1).max(6),
	sides: z.literal(SIDES)
});
const stateSchema = z.object({
	roll: z
		.object({ seed: z.number(), at: z.number(), values: z.array(z.number().int().min(1)) })
		.nullable()
});

export type DiceConfig = z.infer<typeof configSchema>;
export type DiceState = z.infer<typeof stateSchema>;

export const DEFAULT_DICE: DiceConfig = { count: 2, sides: 6 };
const IDLE: DiceState = { roll: null };
const TUMBLE_MS = 600;
const FINISH_WINDOW_MS = 2000;
const ACCENT = '#1971c2';
const MUTED = '#868e96';

export function rollValues(c: DiceConfig, seed: number): number[] {
	const r = rng(seed);
	return Array.from({ length: c.count }, () => 1 + int(r, c.sides));
}

const rolling = (s: DiceState, now: number) => !!s.roll && now < s.roll.at + TUMBLE_MS;
const coin = (v: number) => (v === 1 ? 'Heads' : 'Tails');

export function describeRoll(sides: number, values: readonly number[]): string {
	if (sides === 2) {
		if (values.length === 1) return coin(values[0]!);
		const heads = values.filter((v) => v === 1).length;
		const tails = values.length - heads;
		return `${heads} ${heads === 1 ? 'head' : 'heads'}, ${tails} ${tails === 1 ? 'tail' : 'tails'}`;
	}
	const total = values.reduce((a, b) => a + b, 0);
	if (values.length === 1) return `Rolled ${total}`;
	return `Rolled ${values.slice(0, -1).join(', ')} and ${values.at(-1)}, total ${total}`;
}

// Pip positions on a d6 face, in thirds of its size.
const PIPS: Record<number, [number, number][]> = {
	1: [[1, 1]],
	2: [
		[0, 0],
		[2, 2]
	],
	3: [
		[0, 0],
		[1, 1],
		[2, 2]
	],
	4: [
		[0, 0],
		[2, 0],
		[0, 2],
		[2, 2]
	],
	5: [
		[0, 0],
		[2, 0],
		[1, 1],
		[0, 2],
		[2, 2]
	],
	6: [
		[0, 0],
		[2, 0],
		[0, 1],
		[2, 1],
		[0, 2],
		[2, 2]
	]
};

/** A regular outline for the other dice (d4 triangle, d8 diamond, …). */
function polygon(sides: number, cx: number, cy: number, r: number): string {
	const corners = sides === 4 ? 3 : sides === 8 ? 4 : sides === 10 ? 5 : 6;
	const pts = Array.from({ length: corners }, (_, i) => {
		const a = (i / corners) * Math.PI * 2 - Math.PI / 2;
		return `${n(cx + r * Math.cos(a))},${n(cy + r * Math.sin(a))}`;
	});
	return pts.join(' ');
}

function die(
	sides: number,
	value: number,
	cx: number,
	cy: number,
	size: number,
	ink: string,
	tilt: number
) {
	const h = size / 2;
	let shape: string;
	if (sides === 2) {
		shape =
			`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(h)}" fill="#ffd43b" stroke="${ink}" stroke-width="2"/>` +
			text(
				cx,
				cy + size * 0.14,
				value === 1 ? 'H' : 'T',
				size * 0.4,
				'#1e1e1e',
				'text-anchor="middle" font-weight="700"'
			);
	} else if (sides === 6) {
		const step = size / 4;
		shape =
			`<rect x="${n(cx - h)}" y="${n(cy - h)}" width="${n(size)}" height="${n(size)}" rx="${n(size * 0.18)}" fill="#ffffff" stroke="${ink}" stroke-width="2"/>` +
			(PIPS[value] ?? [])
				.map(
					([i, j]) =>
						`<circle cx="${n(cx - h + step * (i + 1))}" cy="${n(cy - h + step * (j + 1))}" r="${n(size * 0.08)}" fill="${ink}"/>`
				)
				.join('');
	} else {
		shape =
			`<polygon points="${polygon(sides, cx, cy + (sides === 4 ? h * 0.15 : 0), h)}" fill="#ffffff" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>` +
			text(
				cx,
				cy + size * 0.13 + (sides === 4 ? h * 0.2 : 0),
				String(value),
				size * (sides === 4 ? 0.3 : 0.36),
				ink,
				'text-anchor="middle" font-weight="700"'
			);
	}
	return tilt ? `<g transform="rotate(${n(tilt)} ${n(cx)} ${n(cy)})">${shape}</g>` : shape;
}

// Design space 240 × 240: the dice (up to 3 a row), a result line, the Roll button.
function art(
	c: DiceConfig,
	s: DiceState,
	now: number,
	motion: boolean,
	ink: string,
	title: string
) {
	const roll = s.roll;
	const busy = rolling(s, now);
	const step = roll ? Math.floor((now - roll.at) / 80) : 0;
	const values =
		roll && busy && motion
			? roll.values.map((_, i) => 1 + (mix(roll.seed, step * 7 + i) % c.sides))
			: roll && !busy
				? roll.values
				: Array.from({ length: c.count }, (_, i) => (c.sides === 2 ? 1 : Math.min(c.sides, i + 1)));
	const count = values.length;
	const size = count === 1 ? 88 : count === 2 ? 72 : count <= 4 ? 56 : 50;
	const perRow = count === 4 ? 2 : 3;
	const rows = Math.ceil(count / perRow);
	const gap = 16;
	let out = '';
	values.forEach((v, i) => {
		const row = Math.floor(i / perRow);
		const inRow = Math.min(perRow, count - row * perRow);
		const col = i % perRow;
		const cx = 120 + (col - (inRow - 1) / 2) * (size + gap);
		const cy = 84 + (row - (rows - 1) / 2) * (size + gap);
		const tilt = busy && motion && roll ? (mix(roll.seed, step * 13 + i) % 31) - 15 : 0;
		out += die(c.sides, v, cx, cy, size, ink, tilt);
	});
	const line = !roll
		? text(120, 178, title || (c.sides === 2 ? 'Coin' : 'Dice'), 13, MUTED, 'text-anchor="middle"')
		: busy
			? text(120, 178, c.sides === 2 ? 'Flipping…' : 'Rolling…', 13, MUTED, 'text-anchor="middle"')
			: text(
					120,
					178,
					result(c.sides, roll.values),
					16,
					ACCENT,
					'text-anchor="middle" font-weight="700"'
				);
	return out + line;
}

function result(sides: number, values: readonly number[]): string {
	if (sides === 2) return describeRoll(2, values);
	const total = values.reduce((a, b) => a + b, 0);
	return values.length === 1 ? String(total) : `Total ${total}`;
}

export const diceKind: WidgetKind<DiceConfig, DiceState> = {
	kind: 'dice',
	label: 'Dice',
	group: 'Facilitation',
	design: { w: 240, h: 240 },
	parseConfig: (raw) => configSchema.catch(DEFAULT_DICE).parse(raw),
	parseState: (raw) => stateSchema.catch(IDLE).parse(raw),
	defaultConfig: () => ({ ...DEFAULT_DICE }),
	defaultState: () => ({ roll: null }),
	face(c, s, now, title) {
		const done = s.roll && !rolling(s, now);
		return {
			headline: done
				? result(c.sides, s.roll!.values)
				: c.sides === 2
					? 'Coin'
					: `${c.count}d${c.sides}`,
			caption: title || 'Dice',
			ring: null,
			accent: ACCENT
		};
	},
	art: (c, s, now, { motion, ink, title }) => art(c, s, now, motion, ink, title),
	actions(c, s, now) {
		return [
			{
				id: 'roll',
				label: c.sides === 2 ? 'Flip' : 'Roll',
				glyph: { text: c.sides === 2 ? 'Flip' : 'Roll' },
				rect: { x: 70, y: 192, w: 100, h: 36 },
				primary: true,
				disabled: rolling(s, now)
			}
		];
	},
	perform(action, c, s, now, seed) {
		if (action !== 'roll' || rolling(s, now)) return null;
		return { state: { roll: { seed, at: now, values: rollValues(c, seed) } } };
	},
	ticking: (_c, s, now) => rolling(s, now),
	finished(c, s, now) {
		if (!s.roll) return null;
		const end = s.roll.at + TUMBLE_MS;
		if (now < end || now - end > FINISH_WINDOW_MS) return null;
		return { key: String(s.roll.at), sound: false, message: describeRoll(c.sides, s.roll.values) };
	}
};

registerWidgetKind(diceKind);
