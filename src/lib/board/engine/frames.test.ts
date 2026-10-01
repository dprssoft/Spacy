import { describe, expect, it } from 'vitest';
import { samples } from '$lib/model/testFixtures';
import { containsRect, frameFor } from './frames';

const frame = (id: string, z: string, x: number, y: number, w: number, h: number) => ({
	...samples.frame(id, z),
	x,
	y,
	w,
	h
});

describe('frames', () => {
	it('tests full containment', () => {
		const outer = { x: 0, y: 0, w: 100, h: 100 };
		expect(containsRect(outer, { x: 10, y: 10, w: 20, h: 20 })).toBe(true);
		expect(containsRect(outer, { x: 0, y: 0, w: 100, h: 100 })).toBe(true);
		expect(containsRect(outer, { x: 90, y: 10, w: 20, h: 20 })).toBe(false);
	});

	it('picks the topmost containing frame and ignores partial overlaps', () => {
		const a = frame('a', 'a1', 0, 0, 500, 500);
		const b = frame('b', 'a2', 100, 100, 300, 300);
		expect(frameFor({ x: 150, y: 150, w: 50, h: 50 }, [a, b])).toBe('b');
		expect(frameFor({ x: 10, y: 10, w: 50, h: 50 }, [a, b])).toBe('a');
		expect(frameFor({ x: 450, y: 450, w: 100, h: 100 }, [a, b])).toBeNull();
		expect(frameFor({ x: 10, y: 10, w: 50, h: 50 }, [])).toBeNull();
	});
});
