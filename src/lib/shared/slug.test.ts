import { describe, expect, it } from 'vitest';
import { slug } from './slug';

describe('slug', () => {
	it('folds diacritics and lowercases', () => {
		expect(slug('Café Ünïcodé Señor')).toBe('cafe-unicode-senor');
		expect(slug('ø')).toBe(''); // no decomposition: dropped like other symbols
	});
	it('turns symbols into single dashes and trims them', () => {
		expect(slug('  #Plan: v2 / (draft)!! ')).toBe('plan-v2-draft');
		expect(slug('***')).toBe('');
	});
	it('caps the length without a trailing dash', () => {
		const s = slug('word '.repeat(30));
		expect(s.length).toBeLessThanOrEqual(60);
		expect(s.endsWith('-')).toBe(false);
	});
});
