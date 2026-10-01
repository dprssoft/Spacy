import { describe, expect, it } from 'vitest';
import { createElements } from '$lib/model/ops';
import { samples } from '$lib/model/testFixtures';
import { testCtx } from '../testCtx';
import { applyStyle, appearancePatch, mergeStyle } from './applyStyle';
import { commonValue, MIXED, optionsFor } from './options';

describe('style options', () => {
	it('intersects options across types', () => {
		const both = optionsFor(['shape', 'sticky']);
		expect(both.has('fontSize')).toBe(true);
		expect(both.has('fill')).toBe(false);
		expect(both.has('stickyColor')).toBe(false);
		expect(optionsFor(['shape']).has('shapeKind')).toBe(true);
		expect(optionsFor([]).size).toBe(0);
	});

	it('returns the common value or MIXED', () => {
		const a = samples.shape('a');
		const b = { ...samples.shape('b'), style: { ...a.style, fill: '#ff0000' } };
		expect(commonValue([a, a], (el) => el.style.fill)).toBe('#ffffff');
		expect(commonValue([a, b], (el) => el.style.fill)).toBe(MIXED);
		expect(commonValue([a, b], (el) => el.style.font)).toEqual(a.style.font);
		expect(commonValue([], (el) => el.id)).toBe(MIXED);
	});
});

describe('applyStyle', () => {
	it('merges nested font changes without touching other fields', () => {
		const s = samples.shape().style;
		const merged = mergeStyle(s, { fill: '#000000', font: { bold: true } });
		expect(merged).toEqual({ ...s, fill: '#000000', font: { ...s.font, bold: true } });
	});

	it('applies kind to shapes only and color to stickies only', () => {
		expect(appearancePatch(samples.sticky(), { kind: 'ellipse', color: '#a5d8ff' })).toEqual({
			color: '#a5d8ff'
		});
		expect(appearancePatch(samples.shape(), { kind: 'ellipse', color: '#a5d8ff' })).toEqual({
			kind: 'ellipse'
		});
	});

	it('updates several elements as one undo step', () => {
		const ctx = testCtx();
		createElements(ctx.doc, [samples.shape('a'), samples.shape('b')]);
		ctx.undo.stopCapturing();
		applyStyle(ctx, ['a', 'b'], { style: { fill: '#e03131' } });
		expect([ctx.store.get('a')!.style.fill, ctx.store.get('b')!.style.fill]).toEqual([
			'#e03131',
			'#e03131'
		]);
		ctx.history.undo();
		expect(ctx.store.get('a')!.style.fill).toBe('#ffffff');
		expect(ctx.store.get('b')!.style.fill).toBe('#ffffff');
	});

	it('merges continuous changes (slider) into one step', () => {
		const ctx = testCtx();
		createElements(ctx.doc, [samples.shape('a')]);
		ctx.undo.stopCapturing();
		for (const opacity of [0.9, 0.7, 0.5])
			applyStyle(ctx, ['a'], { style: { opacity } }, { continuous: true });
		ctx.history.undo();
		expect(ctx.store.get('a')!.style.opacity).toBe(1);
	});
});
