import { describe, expect, it } from 'vitest';
import { filterSlash, SLASH_ITEMS } from './slash';

const ids = (q: string) => filterSlash(q).map((i) => i.id);

describe('filterSlash', () => {
	it('returns everything for an empty query', () => {
		expect(ids('')).toHaveLength(SLASH_ITEMS.length);
	});

	it('matches title prefixes case-insensitively, headings in order', () => {
		expect(ids('head')).toEqual(['h1', 'h2', 'h3']);
		expect(ids('QUO')).toEqual(['quote']);
	});

	it('matches keywords and words inside titles', () => {
		expect(ids('todo')).toEqual(['task']);
		expect(ids('list')).toEqual(['bullet', 'ordered', 'task']); // Checklist by substring
	});

	it('finds the table by name and keyword', () => {
		expect(ids('tab')).toEqual(['table']);
		expect(ids('grid')).toEqual(['table']);
	});

	it('falls back to substrings after prefixes', () => {
		expect(ids('ode')).toEqual(['code']);
		expect(ids('zzz')).toEqual([]);
	});
});
