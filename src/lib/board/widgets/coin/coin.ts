import { z } from '$lib/shared/zod';
import { registerWidgetKind, type WidgetKind } from '../kinds';
import { rng } from '../random';
import { easeOut, fitText, n, text } from '../svg';

// A coin to flip. A flip stores its seed and side; the turns before it lands come from the seed,
// so every tab shows the same flip. The tally counts flips since the last reset.

export const MAX_LABEL = 24;
const label = z.string().trim().min(1).max(MAX_LABEL);
const configSchema = z.object({ heads: label, tails: label });
const stateSchema = z.object({
	flip: z.object({ seed: z.number(), at: z.number(), side: z.enum(['heads', 'tails']) }).nullable(),
	heads: z.number().int().min(0),
	tails: z.number().int().min(0)
});

export type CoinConfig = z.infer<typeof configSchema>;
export type CoinState = z.infer<typeof stateSchema>;
export type Side = 'heads' | 'tails';

export const DEFAULT_COIN: CoinConfig = { heads: 'Heads', tails: 'Tails' };
const IDLE: CoinState = { flip: null, heads: 0, tails: 0 };
export const FLIP_MS = 1200;
const FINISH_WINDOW_MS = 2000;
const ACCENT = '#e8590c';
const MUTED = '#868e96';
const GOLD = '#ffd43b';
const SILVER = '#dee2e6';

export const flipSide = (seed: number): Side => (rng(seed)() < 0.5 ? 'heads' : 'tails');

const flipping = (s: CoinState, now: number) => !!s.flip && now < s.flip.at + FLIP_MS;

/** Half turns the coin makes: 7–10, odd or even so it lands on its side (it starts on heads). */
function halfTurns(seed: number, side: Side): number {
	const base = 7 + (Math.floor(rng(seed ^ 0x5bd1e995)() * 4) & ~1);
	return side === 'tails' ? base : base + 1;
}

/** How the coin looks at `now`: its side up, how much of it faces us (0..1) and its hop. */
export function coinPose(
	s: CoinState,
	now: number,
	motion: boolean
): { side: Side; open: number; lift: number } {
	const f = s.flip;
	if (!f) return { side: 'heads', open: 1, lift: 0 };
	if (!motion || !flipping(s, now)) return { side: f.side, open: 1, lift: 0 };
	const t = Math.max(0, (now - f.at) / FLIP_MS);
	const angle = easeOut(t) * halfTurns(f.seed, f.side) * Math.PI;
	const shown = Math.floor(angle / Math.PI + 0.5) % 2 === 0 ? 'heads' : 'tails';
	return {
		side: shown,
		open: Math.max(0.06, Math.abs(Math.cos(angle))),
		lift: Math.sin(Math.min(1, t) * Math.PI) * 34
	};
}

const sideLabel = (c: CoinConfig, side: Side) => c[side];

export function describeFlip(c: CoinConfig, s: CoinState): string {
	if (!s.flip) return '';
	const total = s.heads + s.tails;
	const result = sideLabel(c, s.flip.side);
	return total > 1 ? `${result} (${c.heads} ${s.heads}, ${c.tails} ${s.tails})` : result;
}

function coin(
	c: CoinConfig,
	side: Side,
	cx: number,
	cy: number,
	r: number,
	open: number,
	ink: string
) {
	const ry = r * open;
	const fill = side === 'heads' ? GOLD : SILVER;
	// The rim shows below the face while the coin is edge-on.
	const rim = `<ellipse cx="${n(cx)}" cy="${n(cy + 4)}" rx="${n(r)}" ry="${n(ry)}" fill="${ink}" opacity="0.25"/>`;
	const face = `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(r)}" ry="${n(ry)}" fill="${fill}" stroke="${ink}" stroke-width="2"/>`;
	if (open < 0.35) return rim + face;
	const inner = `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(r * 0.82)}" ry="${n(ry * 0.82)}" fill="none" stroke="${ink}" stroke-width="1" opacity="0.35"/>`;
	const word = fitText(sideLabel(c, side), 18, r * 1.5);
	const size = word.length <= 2 ? r * 0.6 : word.length <= 6 ? 20 : 16;
	const glyph = `<g transform="translate(${n(cx)} ${n(cy)}) scale(1 ${n(open)})">${text(0, size * 0.36, word, size, '#1e1e1e', 'text-anchor="middle" font-weight="700"')}</g>`;
	return rim + face + inner + glyph;
}

// Design space 240 × 240: the coin, a result line, the tally, Flip and reset.
function art(
	c: CoinConfig,
	s: CoinState,
	now: number,
	motion: boolean,
	ink: string,
	title: string
) {
	const pose = coinPose(s, now, motion);
	const busy = flipping(s, now);
	let out = coin(c, pose.side, 120, 86 - pose.lift, 52, pose.open, ink);
	const line = !s.flip
		? text(120, 166, title || 'Coin flip', 13, MUTED, 'text-anchor="middle"')
		: busy
			? text(120, 166, 'Flipping…', 13, MUTED, 'text-anchor="middle"')
			: text(
					120,
					166,
					fitText(sideLabel(c, s.flip.side), 16, 200),
					16,
					ACCENT,
					'text-anchor="middle" font-weight="700"'
				);
	out += line;
	// The flip in the air isn't counted yet, so the tally doesn't give it away.
	const heads = s.heads - (busy && s.flip?.side === 'heads' ? 1 : 0);
	const tails = s.tails - (busy && s.flip?.side === 'tails' ? 1 : 0);
	if (heads + tails > 0) {
		const tally = `${fitText(c.heads, 11, 80)} ${heads} · ${fitText(c.tails, 11, 80)} ${tails}`;
		out += text(120, 184, tally, 11, MUTED, 'text-anchor="middle"');
	}
	return out;
}

export const coinKind: WidgetKind<CoinConfig, CoinState> = {
	kind: 'coin',
	label: 'Coin flip',
	group: 'Facilitation',
	design: { w: 240, h: 240 },
	parseConfig: (raw) => configSchema.catch(DEFAULT_COIN).parse(raw),
	parseState: (raw) => stateSchema.catch(IDLE).parse(raw),
	defaultConfig: () => ({ ...DEFAULT_COIN }),
	defaultState: () => ({ ...IDLE }),
	face(c, s, now, title) {
		const done = s.flip && !flipping(s, now);
		return {
			headline: done ? sideLabel(c, s.flip!.side) : 'Flip',
			caption: title || 'Coin flip',
			ring: null,
			accent: ACCENT
		};
	},
	art: (c, s, now, { motion, ink, title }) => art(c, s, now, motion, ink, title),
	actions(_c, s, now) {
		return [
			{
				id: 'flip',
				label: 'Flip',
				glyph: { text: 'Flip' },
				rect: { x: 60, y: 196, w: 100, h: 34 },
				primary: true,
				disabled: flipping(s, now)
			},
			{
				id: 'reset',
				label: 'Reset tally',
				glyph: 'reset',
				rect: { x: 168, y: 196, w: 40, h: 34 },
				disabled: flipping(s, now) || (s.heads + s.tails === 0 && !s.flip)
			}
		];
	},
	perform(action, _c, s, now, seed) {
		if (flipping(s, now)) return null;
		if (action === 'reset') {
			if (s.heads + s.tails === 0 && !s.flip) return null;
			return { state: { ...IDLE }, announce: 'Tally reset' };
		}
		if (action !== 'flip') return null;
		const side = flipSide(seed);
		return {
			state: {
				flip: { seed, at: now, side },
				heads: s.heads + (side === 'heads' ? 1 : 0),
				tails: s.tails + (side === 'tails' ? 1 : 0)
			}
		};
	},
	ticking: (_c, s, now) => flipping(s, now),
	finished(c, s, now) {
		if (!s.flip) return null;
		const end = s.flip.at + FLIP_MS;
		if (now < end || now - end > FINISH_WINDOW_MS) return null;
		return { key: String(s.flip.at), sound: false, message: `Coin flip: ${describeFlip(c, s)}` };
	}
};

registerWidgetKind(coinKind);
