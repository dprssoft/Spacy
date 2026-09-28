import { describe, expect, it } from 'vitest';
import { placeholderGradient } from './placeholderGradient';

describe('placeholderGradient', () => {
	it('is deterministic per id', () => {
		expect(placeholderGradient('abc123')).toBe(placeholderGradient('abc123'));
	});

	it('differs between ids', () => {
		const ids = Array.from({ length: 20 }, (_, i) => `board-${i}`);
		expect(new Set(ids.map(placeholderGradient)).size).toBe(20);
	});

	it('produces soft pastel colors', () => {
		const matches = [...placeholderGradient('x').matchAll(/hsl\((\d+) (\d+)% (\d+)%\)/g)];
		expect(matches).toHaveLength(2);
		for (const [, , s, l] of matches) {
			expect(Number(s)).toBeGreaterThanOrEqual(60);
			expect(Number(s)).toBeLessThanOrEqual(70);
			expect(Number(l)).toBeGreaterThanOrEqual(80);
			expect(Number(l)).toBeLessThanOrEqual(88);
		}
	});
});
