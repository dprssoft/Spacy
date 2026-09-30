import { describe, expect, it } from 'vitest';
import { formatKeys } from './formatKeys';

describe('formatKeys', () => {
	it('formats for macOS', () => {
		expect(formatKeys('Mod+Shift+Z', true)).toBe('⇧⌘Z');
		expect(formatKeys('Mod+Alt+C', true)).toBe('⌥⌘C');
		expect(formatKeys(']', true)).toBe(']');
		expect(formatKeys('Delete', true)).toBe('Del');
	});

	it('formats for Windows/Linux', () => {
		expect(formatKeys('Mod+Shift+Z', false)).toBe('Ctrl+Shift+Z');
		expect(formatKeys('Mod+D', false)).toBe('Ctrl+D');
		expect(formatKeys('Shift+1', false)).toBe('Shift+1');
		expect(formatKeys('Mod++', false)).toBe('Ctrl++');
	});
});
