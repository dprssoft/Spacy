import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPref, removePref, setPref } from './localPrefs';

afterEach(() => {
	vi.restoreAllMocks();
	localStorage.clear();
});

describe('localPrefs', () => {
	it('round-trips JSON values under the spacy: prefix', () => {
		setPref('layout', { view: 'grid', count: 3 });
		expect(localStorage.getItem('spacy:layout')).toBe('{"view":"grid","count":3}');
		expect(getPref('layout', null)).toEqual({ view: 'grid', count: 3 });
	});

	it('returns the fallback for missing keys', () => {
		expect(getPref('missing', 'dflt')).toBe('dflt');
	});

	it('returns the fallback for invalid JSON', () => {
		localStorage.setItem('spacy:broken', '{not json');
		expect(getPref('broken', 42)).toBe(42);
	});

	it('removes values', () => {
		setPref('gone', true);
		removePref('gone');
		expect(getPref('gone', false)).toBe(false);
	});

	it('does not throw when storage throws', () => {
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new DOMException('full', 'QuotaExceededError');
		});
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new DOMException('denied', 'SecurityError');
		});
		expect(() => setPref('x', 1)).not.toThrow();
		expect(getPref('x', 'fallback')).toBe('fallback');
	});
});
