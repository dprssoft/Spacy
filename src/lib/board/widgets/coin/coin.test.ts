import { describe, expect, it } from 'vitest';
import { samples } from '$lib/model/testFixtures';
import { widgetView } from '../kinds';
import { coinKind, coinPose, DEFAULT_COIN, describeFlip, FLIP_MS, flipSide } from './coin';
import '../index';

const c = DEFAULT_COIN;
const idle = coinKind.defaultState();

describe('coin flip', () => {
	it('lands on both sides about evenly', () => {
		let heads = 0;
		for (let seed = 0; seed < 2000; seed++) if (flipSide(seed) === 'heads') heads++;
		expect(heads).toBeGreaterThan(900);
		expect(heads).toBeLessThan(1100);
	});

	it('turns while flipping and lands on the stored side', () => {
		for (let seed = 1; seed < 200; seed++) {
			const s = coinKind.perform('flip', c, idle, 0, seed)!.state!;
			expect(coinKind.ticking(c, s, FLIP_MS / 2)).toBe(true);
			expect(coinKind.perform('flip', c, s, FLIP_MS / 2, 9)).toBeNull();
			// Just before it lands, it already shows the side it lands on.
			expect(coinPose(s, FLIP_MS - 1, true).side).toBe(s.flip!.side);
			expect(coinPose(s, FLIP_MS, true)).toEqual({ side: s.flip!.side, open: 1, lift: 0 });
		}
	});

	it('does not turn with reduced motion', () => {
		const s = coinKind.perform('flip', c, idle, 0, 3)!.state!;
		expect(coinPose(s, 10, false)).toEqual({ side: s.flip!.side, open: 1, lift: 0 });
	});

	it('keeps a tally until reset', () => {
		let s = idle;
		for (let i = 0; i < 5; i++) s = coinKind.perform('flip', c, s, i * 10_000, i + 1)!.state!;
		expect(s.heads + s.tails).toBe(5);
		const done = 5 * 10_000;
		expect(coinKind.face(c, s, done, '').headline).toBe(c[s.flip!.side]);
		expect(describeFlip(c, s)).toBe(`${c[s.flip!.side]} (Heads ${s.heads}, Tails ${s.tails})`);
		const reset = coinKind.perform('reset', c, s, done, 0)!;
		expect(reset.state).toEqual(idle);
		expect(coinKind.perform('reset', c, idle, done, 0)).toBeNull();
	});

	it('uses its own side labels and announces when it lands', () => {
		const yesNo = { heads: 'Yes', tails: 'No' };
		const s = coinKind.perform('flip', yesNo, idle, 0, 42)!.state!;
		expect(coinKind.finished!(yesNo, s, FLIP_MS - 1)).toBeNull();
		expect(coinKind.finished!(yesNo, s, FLIP_MS + 10)?.message).toBe(
			`Coin flip: ${yesNo[s.flip!.side]}`
		);
		expect(coinKind.finished!(yesNo, s, FLIP_MS + 5000)).toBeNull();
	});

	it('counts a flip in the tally only once it lands', () => {
		const first = coinKind.perform('flip', c, idle, 0, 5)!.state!;
		const second = coinKind.perform('flip', c, first, 10_000, 6)!.state!;
		const art = (now: number) =>
			coinKind.art!(c, second, now, { motion: true, ink: '#000', title: '' });
		const tally = (s: typeof first) => `Heads ${s.heads} · Tails ${s.tails}`;
		expect(art(10_100)).toContain(tally(first));
		expect(art(10_000 + FLIP_MS)).toContain(tally(second));
	});

	it('falls back to defaults on bad data', () => {
		expect(coinKind.parseConfig({ heads: '', tails: 3 })).toEqual(DEFAULT_COIN);
		expect(coinKind.parseState('nope')).toEqual(idle);
	});

	it('is registered and draws', () => {
		const view = widgetView({ ...samples.widget('w'), kind: 'coin', config: c, state: null }, 0);
		expect(view.actions.map((a) => a.id)).toEqual(['flip', 'reset']);
		expect(view.art).toContain('Heads');
	});
});
