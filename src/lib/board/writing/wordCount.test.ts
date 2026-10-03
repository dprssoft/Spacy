import { describe, expect, it } from 'vitest';
import { countWords, docStats, docText, formatStats, readingMinutes, textStats } from './wordCount';

describe('countWords', () => {
	it.each([
		['', 0],
		['   ', 0],
		['Hello, world!', 2],
		["It's a well-known fact — 42 times.", 6],
		['Numbers 3.14 and 1,000 count', 5],
		['emoji 🎉 is not a word', 5]
	])('%s → %i', (text, n) => {
		expect(countWords(text)).toBe(n);
	});
});

it('segments languages without spaces into several words (dictionary-dependent)', () => {
	const n = countWords('猫が好きです');
	expect(n).toBeGreaterThanOrEqual(2);
	expect(n).toBeLessThanOrEqual(6);
});

describe('stats', () => {
	it('characters with and without spaces (by code point)', () => {
		expect(textStats('a b 🎉')).toEqual({ words: 2, chars: 5, charsNoSpaces: 3 });
	});

	it('reading time rounds up at 238 wpm', () => {
		expect(readingMinutes(0)).toBe(0);
		expect(readingMinutes(1)).toBe(1);
		expect(readingMinutes(238)).toBe(1);
		expect(readingMinutes(239)).toBe(2);
		expect(formatStats(1)).toBe('1 word · < 1 min read');
		expect(formatStats(1240)).toBe('1,240 words · 6 min read');
		expect(formatStats(0)).toBe('0 words');
	});

	it('reads doc JSON: headings, lists, tasks, mentions, hard breaks', () => {
		const doc = {
			type: 'doc',
			content: [
				{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Chapter one' }] },
				{
					type: 'paragraph',
					content: [
						{ type: 'text', text: 'Meet ' },
						{ type: 'mention', attrs: { id: 'x', label: 'Mara' } },
						{ type: 'hardBreak' },
						{ type: 'text', text: 'again.' }
					]
				},
				{
					type: 'bulletList',
					content: [
						{
							type: 'listItem',
							content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one item' }] }]
						}
					]
				},
				{ type: 'paragraph' }
			]
		};
		expect(docText(doc).text).toBe('Chapter one\nMeet Mara\nagain.\none item');
		expect(docStats(doc)).toMatchObject({ words: 7, paragraphs: 3, readingMinutes: 1 });
	});
});
