import { describe, expect, it } from 'vitest';
import { relativeTime } from './relativeTime';

const NOW = new Date('2026-06-15T12:00:00Z').getTime();
const ago = (ms: number) => relativeTime(NOW - ms, NOW, 'en');
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('relativeTime', () => {
	it.each([
		[0, 'just now'],
		[30_000, 'just now'],
		[50_000, '1 minute ago'],
		[5 * MIN, '5 minutes ago'],
		[2 * HOUR, '2 hours ago'],
		[DAY, 'yesterday'],
		[3 * DAY, '3 days ago'],
		[8 * DAY, 'last week'],
		[21 * DAY, '3 weeks ago'],
		[60 * DAY, '2 months ago'],
		[2 * 365 * DAY, '2 years ago']
	])('%i ms ago → %s', (ms, expected) => {
		expect(ago(ms)).toBe(expected);
	});

	it('handles small clock skew into the future', () => {
		expect(relativeTime(NOW + 10_000, NOW, 'en')).toBe('just now');
	});
});
