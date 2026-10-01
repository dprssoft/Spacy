import { describe, expect, it } from 'vitest';
import { formatBytes } from './formatBytes';

describe('formatBytes', () => {
	it('picks a readable unit', () => {
		expect(formatBytes(0)).toBe('0 B');
		expect(formatBytes(900)).toBe('900 B');
		expect(formatBytes(1536)).toBe('1.5 KB');
		expect(formatBytes(12.3 * 1024 * 1024)).toBe('12.3 MB');
		expect(formatBytes(5 * 1024 ** 3)).toBe('5.0 GB');
	});
});
