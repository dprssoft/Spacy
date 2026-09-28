import { describe, expect, it } from 'vitest';
import { baseStyleFor, DEFAULT_STYLE, newElementBase } from './defaults';
import { jsonEqual } from './equal';
import { styleSchema } from './schema';
import type { ElementType } from './types';

const TYPES: ElementType[] = [
	'shape',
	'sticky',
	'text',
	'image',
	'stroke',
	'frame',
	'doccard',
	'connector'
];

describe('defaults', () => {
	it.each(TYPES)('gives %s a valid style', (type) => {
		expect(styleSchema.safeParse(baseStyleFor(type)).success).toBe(true);
	});

	it('applies per-type tweaks without touching DEFAULT_STYLE', () => {
		expect(baseStyleFor('text').font.align).toBe('l');
		expect(baseStyleFor('doccard').radius).toBe('lg');
		expect(DEFAULT_STYLE.font.align).toBe('c');
	});

	it('centers a default-sized element on the given point', () => {
		const el = newElementBase('shape', 'id1', { x: 100, y: 100 });
		expect([el.x, el.y, el.w, el.h]).toEqual([20, 50, 160, 100]);
		expect(el.style).not.toBe(DEFAULT_STYLE);
	});
});

describe('jsonEqual', () => {
	it.each([
		[1, 1, true],
		[1, '1', false],
		[null, null, true],
		[null, {}, false],
		[[1, [2]], [1, [2]], true],
		[[1], [1, 2], false],
		[[1], { 0: 1 }, false],
		[{ a: 1, b: { c: 2 } }, { b: { c: 2 }, a: 1 }, true],
		[{ a: 1 }, { a: 1, b: 2 }, false],
		[{ a: undefined }, { b: undefined }, false]
	])('jsonEqual(%j, %j) = %s', (a, b, expected) => {
		expect(jsonEqual(a, b)).toBe(expected);
	});
});
