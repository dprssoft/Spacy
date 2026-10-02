import { describe, expect, it } from 'vitest';
import { baseStyleFor } from '$lib/model/defaults';
import { ink, inkFont, seeThrough } from './common';

describe('ink (theme-aware default color)', () => {
	it('maps only the default dark ink', () => {
		expect(ink('#1e1e1e')).toBe('var(--ink)');
		expect(ink('#1E1E1E')).toBe('var(--ink)');
		expect(ink('#e03131')).toBe('#e03131');
		expect(ink('transparent')).toBe('transparent');
	});
	it('keeps text authored when it sits on a solid fill', () => {
		const font = baseStyleFor('shape').font;
		expect(inkFont(font).color).toBe('var(--ink)');
		expect(inkFont(font, false).color).toBe(font.color);
	});
	it('knows when a shape shows the canvas through', () => {
		const style = baseStyleFor('shape');
		expect(seeThrough({ ...style, fill: '#ffffff', fillStyle: 'solid' })).toBe(false);
		expect(seeThrough({ ...style, fillStyle: 'none' })).toBe(true);
		expect(seeThrough({ ...style, fillStyle: 'semi' })).toBe(true);
		expect(seeThrough({ ...style, fill: 'transparent' })).toBe(true);
	});
});
