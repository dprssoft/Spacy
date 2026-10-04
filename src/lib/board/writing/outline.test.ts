import { describe, expect, it } from 'vitest';
import { samples } from '$lib/model/testFixtures';
import type { DocCardElement, FrameElement } from '$lib/model/types';
import { moveInOutline, outlineChapters, outlineIds } from './outline';

const frame = (id: string, x: number, y: number): FrameElement => ({
	...samples.frame(id),
	x,
	y,
	w: 500,
	h: 400
});
const card = (
	id: string,
	x: number,
	y: number,
	parentId: string | null = null
): DocCardElement => ({
	...samples.doccard(id),
	x,
	y,
	parentId
});

// Two chapters side by side, a third below; one loose card.
const frames = [frame('c3', 0, 600), frame('c2', 600, 10), frame('c1', 0, 0)];
const cards = [
	card('b', 300, 20, 'c1'),
	card('a', 20, 20, 'c1'),
	card('c', 620, 30, 'c2'),
	card('d', 20, 620, 'c3'),
	card('loose', 2000, 0)
];

describe('outlineChapters', () => {
	it('reads frames and cards in reading order; loose cards last', () => {
		const ch = outlineChapters(cards, frames, []);
		expect(ch.map((c) => c.frame?.id ?? null)).toEqual(['c1', 'c2', 'c3', null]);
		expect(outlineIds(ch)).toEqual(['a', 'b', 'c', 'd', 'loose']);
	});

	it('a stored order wins; unknown and deleted ids are handled', () => {
		const ch = outlineChapters(cards, frames, ['b', 'gone', 'a']);
		expect(outlineIds(ch)).toEqual(['b', 'a', 'c', 'd', 'loose']);
	});

	it('skips empty chapters', () => {
		expect(outlineChapters([card('x', 0, 0, 'c1')], frames, []).map((c) => c.frame?.id)).toEqual([
			'c1'
		]);
	});
});

describe('moveInOutline', () => {
	it('moves within a chapter and across chapters', () => {
		const ch = outlineChapters(cards, frames, []);
		expect(moveInOutline(ch, 'b', 'c1', 0)).toEqual(['b', 'a', 'c', 'd', 'loose']);
		expect(moveInOutline(ch, 'a', 'c2', 1)).toEqual(['b', 'c', 'a', 'd', 'loose']);
		expect(moveInOutline(ch, 'd', null, 0)).toEqual(['a', 'b', 'c', 'd', 'loose']);
		expect(moveInOutline(ch, 'nope', 'c1', 0)).toEqual(outlineIds(ch));
	});
});
