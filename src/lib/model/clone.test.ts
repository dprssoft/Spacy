import { afterEach, describe, expect, it } from 'vitest';
import { cloneElements, cloneHooks } from './clone';
import { samples } from './testFixtures';

afterEach(() => {
	cloneHooks.length = 0;
});

describe('cloneElements', () => {
	it('gives new ids, shifts by the offset and drops z', () => {
		const src = samples.shape('a');
		const { elements, idMap } = cloneElements([src], { offset: { x: 16, y: 8 } });
		const [copy] = elements;
		expect(copy?.id).not.toBe('a');
		expect(idMap.get('a')).toBe(copy?.id);
		expect([copy?.x, copy?.y]).toEqual([src.x + 16, src.y + 8]);
		expect(copy).not.toHaveProperty('z');
	});

	it('maps each old group to one new group', () => {
		const a = { ...samples.shape('a'), groupId: 'g1' };
		const b = { ...samples.sticky('b'), groupId: 'g1' };
		const c = { ...samples.text('c'), groupId: 'g2' };
		const { elements } = cloneElements([a, b, c], { offset: { x: 0, y: 0 } });
		const [ga, gb, gc] = elements.map((e) => e.groupId);
		expect(ga).toBe(gb);
		expect(ga).not.toBe('g1');
		expect(gc).not.toBe(ga);
		expect(gc).not.toBe('g2');
	});

	it('remaps parents that are cloned too and keeps the others', () => {
		const frame = samples.frame('f');
		const inside = { ...samples.sticky('s'), parentId: 'f' };
		const outside = { ...samples.text('t'), parentId: 'other-frame' };
		const { elements, idMap } = cloneElements([frame, inside, outside], { offset: { x: 0, y: 0 } });
		expect(elements[1]?.parentId).toBe(idMap.get('f'));
		expect(elements[2]?.parentId).toBe('other-frame');
	});

	it('respects a pre-seeded id map and runs hooks with the full map', () => {
		const idMap = new Map([['a', 'fixed-id']]);
		cloneHooks.push((el, map) => ({ ...el, text: `hook saw ${map.size}` }) as typeof el);
		const { elements } = cloneElements([samples.shape('a'), samples.shape('b')], {
			offset: { x: 0, y: 0 },
			idMap
		});
		expect(elements[0]?.id).toBe('fixed-id');
		expect(elements.map((e) => ('text' in e ? e.text : ''))).toEqual(['hook saw 2', 'hook saw 2']);
	});

	it('does not mutate the source elements', () => {
		const src = samples.connector();
		const before = structuredClone(src);
		const { elements } = cloneElements([src], { offset: { x: 5, y: 5 } });
		(elements[0] as typeof src).waypoints.push({ x: 0, y: 0 });
		expect(src).toEqual(before);
	});
});
