import { describe, expect, it } from 'vitest';
import { createCanvasMeasurer, wrapText } from './wrapText';

const mono = (s: string) => s.length * 10; // 10 px per character

describe('wrapText', () => {
	it('keeps explicit newlines and empty lines', () => {
		expect(wrapText('a\n\nb', 100, mono)).toEqual(['a', '', 'b']);
	});
	it('breaks at spaces', () => {
		expect(wrapText('one two three four', 90, mono)).toEqual(['one two', 'three', 'four']);
	});
	it('hard-breaks words longer than a line', () => {
		expect(wrapText('abcdefghij x', 40, mono)).toEqual(['abcd', 'efgh', 'ij x']);
	});
	it('handles empty text and unlimited width', () => {
		expect(wrapText('', 50, mono)).toEqual(['']);
		expect(wrapText('no wrap at all here', Infinity, mono)).toEqual(['no wrap at all here']);
	});
	it('falls back to an estimate without a canvas', () => {
		const m = createCanvasMeasurer();
		expect(m('abcd', { size: 10, family: 'x' })).toBeGreaterThan(0);
	});
});
