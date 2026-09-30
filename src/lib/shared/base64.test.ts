import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64 } from './base64';

describe('base64', () => {
	it.each([0, 1, 2, 3, 1000])('round-trips %i bytes', (n) => {
		const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37) % 256);
		expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
	});

	it('round-trips 1 MB of random bytes (no call-stack overflow)', () => {
		const bytes = new Uint8Array(1024 * 1024);
		for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
		// Buffer comparison: a deep toEqual over a million elements is very slow.
		const back = base64ToBytes(bytesToBase64(bytes));
		expect(Buffer.from(back).equals(Buffer.from(bytes))).toBe(true);
	});

	it('matches the standard encoding', () => {
		expect(bytesToBase64(new TextEncoder().encode('hello'))).toBe('aGVsbG8=');
	});

	it('throws on malformed input', () => {
		expect(() => base64ToBytes('%%%')).toThrow();
	});
});
