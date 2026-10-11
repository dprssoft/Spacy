import { z } from '$lib/shared/zod';
import { registerWidgetKind, type WidgetKind } from '../kinds';
import { mix, pick, rng, shuffle, teams } from '../random';
import { fitText, text } from '../svg';

// Picks from a list, shuffles it, or splits it into teams. The result is drawn once from a seed
// and stored, so everyone sees the same draw.

export const MAX_ITEMS = 200;
const configSchema = z.object({
	items: z.array(z.string().max(100)).max(MAX_ITEMS),
	mode: z.enum(['pick', 'shuffle', 'teams']),
	/** pick: how many; teams: how many teams. */
	count: z.number().int().min(1).max(50)
});
const stateSchema = z.object({
	draw: z
		.object({
			seed: z.number(),
			at: z.number(),
			mode: z.enum(['pick', 'shuffle', 'teams']),
			result: z.array(z.array(z.string()))
		})
		.nullable()
});

export type RandomizerConfig = z.infer<typeof configSchema>;
export type RandomizerState = z.infer<typeof stateSchema>;
export type RandomizerMode = RandomizerConfig['mode'];

export const DEFAULT_RANDOMIZER: RandomizerConfig = {
	items: ['Alex', 'Sam', 'Robin', 'Kim', 'Jordan', 'Taylor'],
	mode: 'pick',
	count: 1
};
const IDLE: RandomizerState = { draw: null };
const SHUFFLE_MS = 700;
const FINISH_WINDOW_MS = 2000;
const ACCENT = '#1971c2';
const MUTED = '#868e96';

export const entries = (c: RandomizerConfig): string[] =>
	c.items.map((s) => s.trim()).filter(Boolean);

/** How many teams (at least 2) or picks a mode uses. */
export const teamCount = (c: RandomizerConfig) => Math.max(2, c.count);

export function drawLots(c: RandomizerConfig, seed: number): string[][] {
	const items = entries(c);
	const r = rng(seed);
	if (c.mode === 'teams') return teams(items, teamCount(c), r);
	if (c.mode === 'shuffle') return [shuffle(items, r)];
	return [pick(items, c.count, r)];
}

const drawing = (s: RandomizerState, now: number) => !!s.draw && now < s.draw.at + SHUFFLE_MS;

function summary(c: RandomizerConfig): string {
	const n = entries(c).length;
	const items = `${n} ${n === 1 ? 'item' : 'items'}`;
	if (c.mode === 'teams') return `${items} · ${teamCount(c)} teams`;
	if (c.mode === 'shuffle') return `${items} · shuffle`;
	return `${items} · pick ${c.count}`;
}

function describe(mode: RandomizerMode, result: string[][]): string {
	if (mode === 'teams') return `${result.length} teams ready`;
	if (mode === 'shuffle') return `Shuffled: ${result[0]?.join(', ') ?? ''}`;
	return `Picked: ${result[0]?.join(', ') ?? ''}`;
}

// Design space 260 × 300: a header, the result (y 56–236), the buttons.
const W = 260;
const ROWS = 8;

function column(items: string[], x: number, w: number, top: number, size: number, ink: string) {
	const lineH = size + 8;
	const max = Math.floor((236 - top) / lineH);
	const shown = items.length > max ? items.slice(0, max - 1) : items;
	let out = shown.map((s, i) => text(x, top + i * lineH, fitText(s, size, w), size, ink)).join('');
	if (shown.length < items.length)
		out += text(x, top + shown.length * lineH, `+${items.length - shown.length} more`, size, MUTED);
	return out;
}

function art(
	c: RandomizerConfig,
	s: RandomizerState,
	now: number,
	motion: boolean,
	ink: string,
	title: string
) {
	let out =
		text(16, 30, fitText(title || 'Randomizer', 15, W - 32), 15, ink, 'font-weight="600"') +
		text(16, 48, summary(c), 12, MUTED);
	const draw = s.draw;
	if (!draw) return out + text(W / 2, 146, 'Press Draw', 14, MUTED, 'text-anchor="middle"');
	if (drawing(s, now)) {
		if (!motion) return out + text(W / 2, 146, 'Drawing…', 14, MUTED, 'text-anchor="middle"');
		// The same scramble on every screen: derived from the seed and the time step.
		const step = Math.floor((now - draw.at) / 80);
		const items = shuffle(entries(c), rng(mix(draw.seed, step))).slice(0, ROWS);
		return out + `<g opacity="0.5">${column(items, 16, W - 32, 80, 14, ink)}</g>`;
	}
	if (draw.mode !== 'teams') {
		const numbered = (draw.result[0] ?? []).map((v, i) => `${i + 1}. ${v}`);
		return out + column(numbered, 16, W - 32, 80, 14, ink);
	}
	const cols = draw.result.slice(0, 4);
	const colW = (W - 32) / cols.length;
	cols.forEach((members, i) => {
		const x = 16 + i * colW;
		out += text(x, 76, `Team ${i + 1}`, 12, ACCENT, 'font-weight="700"');
		out += column(members, x, colW - 8, 96, 12, ink);
	});
	if (draw.result.length > cols.length)
		out += text(W - 16, 48, `showing 4 of ${draw.result.length}`, 11, MUTED, 'text-anchor="end"');
	return out;
}

export const randomizerKind: WidgetKind<RandomizerConfig, RandomizerState> = {
	kind: 'randomizer',
	label: 'Randomizer',
	group: 'Facilitation',
	design: { w: W, h: 300 },
	parseConfig: (raw) => configSchema.catch(DEFAULT_RANDOMIZER).parse(raw),
	parseState: (raw) => stateSchema.catch(IDLE).parse(raw),
	defaultConfig: () => structuredClone(DEFAULT_RANDOMIZER),
	defaultState: () => ({ draw: null }),
	face(c, s, now, title) {
		const first = !drawing(s, now) ? s.draw?.result[0]?.[0] : undefined;
		return {
			headline: first ?? summary(c),
			caption: title || 'Randomizer',
			ring: null,
			accent: ACCENT
		};
	},
	art: (c, s, now, { motion, ink, title }) => art(c, s, now, motion, ink, title),
	actions(c, s, now) {
		const busy = drawing(s, now);
		return [
			{
				id: 'draw',
				label: c.mode === 'teams' ? 'Make teams' : c.mode === 'shuffle' ? 'Shuffle' : 'Draw',
				glyph: { text: 'Draw' },
				rect: { x: 16, y: 252, w: 140, h: 36 },
				primary: true,
				disabled: busy || entries(c).length === 0
			},
			{
				id: 'place',
				label: 'Place as sticky notes',
				glyph: { text: 'Place' },
				rect: { x: 164, y: 252, w: 80, h: 36 },
				disabled: busy || !s.draw || s.draw.result.every((col) => col.length === 0)
			}
		];
	},
	perform(action, c, s, now, seed) {
		if (drawing(s, now)) return null;
		if (action === 'draw') {
			if (entries(c).length === 0) return null;
			return { state: { draw: { seed, at: now, mode: c.mode, result: drawLots(c, seed) } } };
		}
		if (action === 'place' && s.draw) return { place: s.draw.result };
		return null;
	},
	ticking: (_c, s, now) => drawing(s, now),
	finished(_c, s, now) {
		if (!s.draw) return null;
		const end = s.draw.at + SHUFFLE_MS;
		if (now < end || now - end > FINISH_WINDOW_MS) return null;
		return { key: String(s.draw.at), sound: false, message: describe(s.draw.mode, s.draw.result) };
	}
};

registerWidgetKind(randomizerKind);
