import { describe, expect, it } from 'vitest';
import { drawLots, randomizerKind, type RandomizerConfig } from './randomizer';

const c = (extra: Partial<RandomizerConfig>): RandomizerConfig => ({
	items: ['a', 'b', ' ', 'c', 'd', 'e'],
	mode: 'pick',
	count: 2,
	...extra
});

describe('randomizer', () => {
	it('picks, shuffles and makes teams from the non-empty items', () => {
		expect(drawLots(c({}), 1)[0]).toHaveLength(2);
		expect([...drawLots(c({ mode: 'shuffle' }), 1)[0]!].sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
		const teams = drawLots(c({ mode: 'teams', count: 1 }), 1);
		expect(teams).toHaveLength(2); // at least two teams
		expect(teams.flat().sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
	});

	it('stores the draw, and places it as sticky notes (columns for teams)', () => {
		const cfg = c({ mode: 'teams', count: 2 });
		const write = randomizerKind.perform('draw', cfg, { draw: null }, 0, 5)!;
		const s = write.state!;
		expect(s.draw!.result).toEqual(drawLots(cfg, 5));
		expect(randomizerKind.perform('place', cfg, s, 100, 0)).toBeNull(); // still shuffling
		expect(randomizerKind.perform('place', cfg, s, 1000, 0)!.place).toEqual(s.draw!.result);
		expect(randomizerKind.finished!(cfg, s, 800)?.message).toBe('2 teams ready');
	});

	it('has nothing to draw from an empty list', () => {
		const empty = c({ items: [' '] });
		expect(randomizerKind.perform('draw', empty, { draw: null }, 0, 1)).toBeNull();
		expect(randomizerKind.actions(empty, { draw: null }, 0)[0]!.disabled).toBe(true);
		expect(randomizerKind.actions(empty, { draw: null }, 0)[1]!.disabled).toBe(true);
	});
});
