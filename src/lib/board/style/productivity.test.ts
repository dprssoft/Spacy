import { afterEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { baseStyleFor } from '$lib/model/defaults';
import { createElements } from '$lib/model/ops';
import { samples } from '$lib/model/testFixtures';
import { arrange } from '../commands/arrange';
import { syncFrameMembership } from '../frameMembership';
import { testCtx } from '../testCtx';
import { STYLE_OPTIONS } from './options';
import { pickStyle } from './pickStyle';
import { DEFAULT_PRESETS, getPresets, presetPatch, updatePreset } from './quickStyles';
import { copyStyle, pasteStyle } from './styleClipboard';
import {
	getDefaultStyle,
	hasCustomDefault,
	resetDefaultStyle,
	setDefaultStyle
} from './styleDefaults';

afterEach(() => localStorage.clear());

describe('quick styles', () => {
	it('falls back to the defaults and persists updates in the board', () => {
		const doc = new Y.Doc();
		expect(getPresets(doc)).toEqual(DEFAULT_PRESETS.map((p) => p.style));
		const custom = { ...DEFAULT_PRESETS[0]!.style, fill: '#123456' };
		updatePreset(doc, 2, custom);
		expect(getPresets(doc)[2]!.fill).toBe('#123456');
		expect(getPresets(doc)[0]).toEqual(DEFAULT_PRESETS[0]!.style);
	});

	it('only applies colors and line style the target supports', () => {
		const dark = DEFAULT_PRESETS.find((p) => p.name === 'Dark')!.style;
		expect(presetPatch(dark, new Set(STYLE_OPTIONS.shape))).toEqual({
			fill: dark.fill,
			fillStyle: dark.fillStyle,
			stroke: dark.stroke,
			dash: dark.dash,
			font: { color: '#ffffff' }
		});
		expect(presetPatch(dark, new Set(STYLE_OPTIONS.sticky))).toEqual({});
	});
});

describe('pickStyle', () => {
	it('keeps only the fields an element type controls', () => {
		const s = { ...baseStyleFor('shape'), fill: '#ff0000', strokeWidth: 8 as const };
		const forText = pickStyle(s, new Set(STYLE_OPTIONS.text));
		expect(forText).not.toHaveProperty('fill');
		expect(forText).toMatchObject({ opacity: 1, font: { size: 'm', color: '#1e1e1e' } });
		expect(pickStyle(s, new Set(STYLE_OPTIONS.stroke))).toEqual({
			stroke: s.stroke,
			strokeWidth: 8,
			opacity: 1
		});
	});
});

describe('style defaults', () => {
	it('layers the saved default over the built-in style and can be reset', () => {
		expect(hasCustomDefault('shape')).toBe(false);
		setDefaultStyle('shape', { ...baseStyleFor('shape'), fill: '#a5d8ff' });
		expect(getDefaultStyle('shape').fill).toBe('#a5d8ff');
		expect(getDefaultStyle('sticky')).toEqual(baseStyleFor('sticky'));
		resetDefaultStyle('shape');
		expect(getDefaultStyle('shape')).toEqual(baseStyleFor('shape'));
	});

	it('ignores corrupted saved defaults', () => {
		localStorage.setItem('spacy:defaults:shape', JSON.stringify({ strokeWidth: 3 }));
		expect(getDefaultStyle('shape')).toEqual(baseStyleFor('shape'));
	});
});

describe('copy / paste style', () => {
	it('pastes only applicable fields onto each target, as one undo step', () => {
		const ctx = testCtx();
		const red = { ...baseStyleFor('shape'), fill: '#e03131', strokeWidth: 4 as const };
		createElements(ctx.doc, [
			{ ...samples.shape('src'), style: red },
			samples.shape('dst'),
			samples.text('t')
		]);
		ctx.selection.set(['src']);
		expect(copyStyle(ctx)).toBe(true);
		ctx.undo.stopCapturing();
		ctx.selection.set(['dst', 't']);
		expect(pasteStyle(ctx)).toBe(true);
		expect(ctx.store.get('dst')!.style).toMatchObject({ fill: '#e03131', strokeWidth: 4 });
		expect(ctx.store.get('t')!.style.fill).toBe('transparent'); // text has no fill option
		ctx.history.undo();
		expect(ctx.store.get('dst')!.style.fill).toBe('#ffffff');
	});
});

describe('arrange', () => {
	it('aligns elements and moves frame contents with their frame', () => {
		const ctx = testCtx();
		createElements(ctx.doc, [
			{ ...samples.frame('f', 'a0'), x: 300, y: 0, w: 200, h: 200 },
			{ ...samples.sticky('in', 'a1'), x: 350, y: 50, w: 50, h: 50 },
			{ ...samples.shape('s', 'a2'), x: 0, y: 500, w: 100, h: 50 }
		]);
		syncFrameMembership(ctx, ['in']);
		ctx.selection.set(['f', 's']);
		arrange(ctx, { kind: 'align', edge: 'left' });
		expect(ctx.store.get('f')!.x).toBe(0);
		expect(ctx.store.get('in')!.x).toBe(50);
		expect(ctx.store.get('in')!.parentId).toBe('f');
		ctx.history.undo();
		expect(ctx.store.get('f')!.x).toBe(300);
	});

	it('matches sizes', () => {
		const ctx = testCtx();
		createElements(ctx.doc, [
			{ ...samples.shape('a'), w: 100, h: 50 },
			{ ...samples.shape('b'), w: 40, h: 80 }
		]);
		ctx.selection.set(['a', 'b']);
		arrange(ctx, { kind: 'match', dim: 'both' });
		expect([ctx.store.get('a')!.w, ctx.store.get('b')!.h]).toEqual([100, 80]);
		expect([ctx.store.get('b')!.w, ctx.store.get('a')!.h]).toEqual([100, 80]);
	});
});
