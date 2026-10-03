import { describe, expect, it } from 'vitest';
import { gridTileSize, gridTileUrl } from './grid';

describe('grid tiles', () => {
	it('picks the power of two nearest to the gap, within limits', () => {
		expect(gridTileSize(24)).toBe(32);
		expect(gridTileSize(9.6)).toBe(8);
		expect(gridTileSize(16)).toBe(16);
		expect(gridTileSize(1)).toBe(4);
		expect(gridTileSize(500)).toBe(128);
	});

	it('keeps the dot between 0.7 and 1.4 px on screen', () => {
		for (let gap = 6; gap <= 96; gap += 0.5) {
			const r = gap / gridTileSize(gap);
			expect(r).toBeGreaterThanOrEqual(0.7);
			expect(r).toBeLessThanOrEqual(1.42);
		}
	});

	it('encodes the dot color into a data URL', () => {
		const url = gridTileUrl(8, '#d4d4d8');
		expect(url.startsWith('url("data:image/svg+xml,')).toBe(true);
		expect(decodeURIComponent(url)).toContain('cx="4" cy="4" r="1" fill="#d4d4d8"');
	});
});
