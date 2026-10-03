import { describe, expect, it } from 'vitest';
import { keepInView } from './keyboard.svelte';

describe('keepInView', () => {
	it('moves content up above the keyboard, down below the top, or not at all', () => {
		expect(keepInView({ top: 500, bottom: 560 }, 50, 400)).toBe(400 - 12 - 560);
		expect(keepInView({ top: 20, bottom: 80 }, 50, 400)).toBe(50 + 12 - 20);
		expect(keepInView({ top: 100, bottom: 200 }, 50, 400)).toBe(0);
		// Taller than the space: keep its bottom (the caret line) visible.
		expect(keepInView({ top: 0, bottom: 900 }, 50, 400)).toBe(400 - 12 - 900);
	});
});
