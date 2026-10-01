import { describe, expect, it } from 'vitest';
import { strokePathMemo, strokeSvgPath } from './strokePath';

describe('strokePathMemo', () => {
	const points = [0, 0, 0.5, 40, 10, 0.5, 80, 0, 0.5, 120, 30, 0.5];

	it('returns the same path for an equal copy of the points (a moved stroke)', () => {
		const path = strokePathMemo();
		const first = path(points, 2);
		expect(first).toBe(strokeSvgPath(points, 2));
		expect(path([...points], 2)).toBe(first);
	});

	it('recomputes when the points or the width change', () => {
		const path = strokePathMemo();
		const first = path(points, 2);
		expect(path(points, 4)).not.toBe(first);
		expect(path([...points.slice(0, -3), 160, 60, 0.5], 4)).toBe(
			strokeSvgPath([...points.slice(0, -3), 160, 60, 0.5], 4)
		);
	});
});
