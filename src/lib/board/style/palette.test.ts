import { describe, expect, it } from 'vitest';
import { PALETTE, STICKY_COLORS } from '$lib/model/defaults';
import {
	normalizeHex,
	OPAQUE_SWATCHES,
	PALETTE_COLUMNS,
	PALETTE_SWATCHES,
	STICKY_SWATCHES
} from './palette';

describe('palette', () => {
	it('fills whole rows with unique colors and names', () => {
		for (const grid of [PALETTE_SWATCHES, OPAQUE_SWATCHES, STICKY_SWATCHES]) {
			expect(grid.length % PALETTE_COLUMNS === 0 || grid === STICKY_SWATCHES).toBe(true);
			expect(new Set(grid.map((c) => c.value)).size).toBe(grid.length);
			expect(new Set(grid.map((c) => c.name)).size).toBe(grid.length);
		}
		expect(OPAQUE_SWATCHES.some((c) => c.value === 'transparent')).toBe(false);
	});

	it('keeps the original colors, under their names', () => {
		for (const value of PALETTE) expect(PALETTE_SWATCHES.map((c) => c.value)).toContain(value);
		for (const [name, value] of Object.entries(STICKY_COLORS))
			expect(STICKY_SWATCHES.find((c) => c.value === value)?.name.toLowerCase()).toBe(name);
		expect(PALETTE_SWATCHES.find((c) => c.value === '#e03131')?.name).toBe('Red');
	});

	it('normalizes typed hex colors', () => {
		expect(normalizeHex('#ABC')).toBe('#aabbcc');
		expect(normalizeHex(' 12ab9F ')).toBe('#12ab9f');
		expect(normalizeHex('#12345')).toBeNull();
		expect(normalizeHex('red')).toBeNull();
	});
});
