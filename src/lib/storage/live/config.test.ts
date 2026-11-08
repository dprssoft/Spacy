import { describe, expect, it } from 'vitest';
import { parseTurnConfig } from './config';

describe('parseTurnConfig', () => {
	it('is empty when no TURN URLs are set', () => {
		expect(parseTurnConfig({ urls: '', username: 'u', credential: 'c' })).toEqual([]);
		expect(parseTurnConfig({ urls: ' , stun:x:3478', username: '', credential: '' })).toEqual([]);
	});

	it('keeps turn: and turns: URLs with their credentials', () => {
		expect(
			parseTurnConfig({
				urls: 'turn:a.example:80, turns:a.example:443?transport=tcp,https://nope',
				username: 'u',
				credential: 'c'
			})
		).toEqual([
			{
				urls: ['turn:a.example:80', 'turns:a.example:443?transport=tcp'],
				username: 'u',
				credential: 'c'
			}
		]);
	});
});
