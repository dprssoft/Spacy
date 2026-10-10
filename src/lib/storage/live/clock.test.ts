import { describe, expect, it } from 'vitest';
import { clockSkewMs, describeSkew } from './clock';

const server = (date: string) => async () => new Response(null, { headers: { date } });

describe('clockSkewMs', () => {
	it('measures how far this clock is from the server', async () => {
		const real = Date.parse('Sat, 10 Oct 2026 17:35:55 GMT');
		const skew = await clockSkewMs(
			server('Sat, 10 Oct 2026 17:35:55 GMT'),
			() => real + 3 * 3600_000
		);
		expect(skew).toBe(3 * 3600_000);
		expect(describeSkew(skew!)).toBe('about 3 hours ahead');
		expect(describeSkew(-12 * 60_000)).toBe('about 12 minutes behind');
	});

	it('is unknown without a Date header or a network', async () => {
		expect(await clockSkewMs(async () => new Response(null))).toBeNull();
		expect(await clockSkewMs(async () => Promise.reject(new Error('offline')))).toBeNull();
	});
});
