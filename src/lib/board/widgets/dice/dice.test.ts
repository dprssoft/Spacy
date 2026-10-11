import { describe, expect, it } from 'vitest';
import { describeRoll, diceKind, rollValues, SIDES } from './dice';

describe('dice', () => {
	it.each(SIDES)('rolls values from 1 to %i', (sides) => {
		for (let seed = 0; seed < 300; seed++) {
			for (const v of rollValues({ count: 6, sides }, seed)) {
				expect(v).toBeGreaterThanOrEqual(1);
				expect(v).toBeLessThanOrEqual(sides);
			}
		}
	});

	it('describes rolls and flips', () => {
		expect(describeRoll(6, [4])).toBe('Rolled 4');
		expect(describeRoll(6, [3, 5])).toBe('Rolled 3 and 5, total 8');
		expect(describeRoll(2, [1])).toBe('Heads');
		expect(describeRoll(2, [1, 2, 2])).toBe('1 head, 2 tails');
	});

	it('tumbles briefly, then shows the total', () => {
		const c = { count: 2, sides: 6 as const };
		const s = diceKind.perform('roll', c, { roll: null }, 0, 77)!.state!;
		expect(diceKind.ticking(c, s, 100)).toBe(true);
		expect(diceKind.perform('roll', c, s, 100, 1)).toBeNull();
		const total = s.roll!.values[0]! + s.roll!.values[1]!;
		expect(diceKind.face(c, s, 1000, '').headline).toBe(`Total ${total}`);
		expect(diceKind.finished!(c, s, 700)?.message).toMatch(/^Rolled \d and \d, total \d+$/);
	});
});
