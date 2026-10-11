import { describe, expect, it } from 'vitest';
import { createElements, listElements } from '$lib/model';
import { samples } from '$lib/model/testFixtures';
import type { WidgetElement } from '$lib/model/types';
import { testCtx } from '../testCtx';
import { wheelFromSelection } from './create';
import { segmentAt, rotationAt, wheelKind } from './wheel/wheel';

const sticky = (id: string, x: number, y: number, text: string) => ({
	...samples.sticky(id),
	x,
	y,
	text
});

describe('chance widgets on a board', () => {
	it('makes a wheel from the selected notes, right of them; one undo removes it', () => {
		const ctx = testCtx();
		createElements(ctx.doc, [
			sticky('b', 0, 300, 'Bea'),
			sticky('a', 0, 0, 'Ann'),
			sticky('c', 200, 0, '  '),
			sticky('d', 200, 300, 'Dan')
		]);
		ctx.undo.stopCapturing();
		ctx.selection.set(['a', 'b', 'c', 'd']);
		const id = wheelFromSelection(ctx)!;
		const w = ctx.store.get(id) as WidgetElement;
		const config = wheelKind.parseConfig(w.config);
		expect(config.segments.map((s) => s.label)).toEqual(['Ann', 'Bea', 'Dan']);
		expect(w.x).toBeGreaterThan(300);
		expect([...ctx.selection.ids]).toEqual([id]);
		ctx.undo.undo();
		expect(ctx.store.get(id)).toBeUndefined();
	});

	it('needs at least two texts', () => {
		const ctx = testCtx();
		createElements(ctx.doc, [sticky('a', 0, 0, 'Ann')]);
		ctx.selection.set(['a']);
		expect(wheelFromSelection(ctx)).toBeNull();
	});

	it('a spin through the board lands where its state says', () => {
		const ctx = testCtx();
		createElements(ctx.doc, [sticky('a', 0, 0, 'Ann'), sticky('b', 0, 300, 'Bea')]);
		ctx.selection.set(['a', 'b']);
		const id = wheelFromSelection(ctx)!;
		expect(ctx.widgets.run(id, 'spin')).toBe(true);
		expect(ctx.widgets.run(id, 'spin')).toBe(false); // still turning
		const w = ctx.store.get(id) as WidgetElement;
		const s = wheelKind.parseState(w.state);
		expect(segmentAt(2, rotationAt(s, Date.now() + 60_000))).toBe(s.spin!.winner);
	});

	it('places a randomizer draw as sticky notes in one undo step', () => {
		const ctx = testCtx();
		createElements(ctx.doc, [
			{
				...samples.widget('r'),
				kind: 'randomizer',
				config: { items: ['a', 'b', 'c', 'd'], mode: 'teams', count: 2 },
				state: {
					draw: {
						seed: 1,
						at: 0,
						mode: 'teams',
						result: [
							['a', 'c'],
							['b', 'd']
						]
					}
				}
			}
		]);
		ctx.undo.stopCapturing();
		expect(ctx.widgets.run('r', 'place')).toBe(true);
		const stickies = listElements(ctx.doc).filter((e) => e.type === 'sticky');
		expect(stickies.map((e) => (e.type === 'sticky' ? e.text : '')).sort()).toEqual([
			'a',
			'b',
			'c',
			'd'
		]);
		expect(new Set(stickies.map((e) => e.x)).size).toBe(2); // two columns
		expect(ctx.selection.size).toBe(4);
		ctx.undo.undo();
		expect(listElements(ctx.doc).filter((e) => e.type === 'sticky')).toHaveLength(0);
	});
});
