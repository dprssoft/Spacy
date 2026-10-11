import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GisAuth } from './gisAuth';

type Req = { prompt?: string; login_hint?: string };

// gisAuth loads Google's script once per module, so every test shares one stub.
const gis = {
	requests: [] as Req[],
	callback: (() => {}) as (r: { access_token?: string; expires_in?: number }) => void,
	grant() {
		this.callback({ access_token: 'tok', expires_in: 3600 });
	}
};
(globalThis as { google?: unknown }).google = {
	accounts: {
		oauth2: {
			initTokenClient(c: { callback: typeof gis.callback }) {
				gis.callback = c.callback;
				return { callback: c.callback, requestAccessToken: (o: Req) => gis.requests.push(o) };
			},
			revoke() {}
		}
	}
};

const click = () => document.dispatchEvent(new Event('pointerdown'));

describe('GisAuth', () => {
	let auth: GisAuth | null = null;
	beforeEach(() => {
		vi.useFakeTimers();
		gis.requests = [];
	});
	afterEach(() => {
		auth?.destroy();
		vi.useRealTimers();
	});

	it('passes the remembered account as a login hint', async () => {
		auth = new GisAuth(
			'id',
			() => {},
			() => 'me@example.com'
		);
		await auth.prepare();
		void auth.signIn('');
		expect(gis.requests).toEqual([{ prompt: '', login_hint: 'me@example.com' }]);
	});

	it('renews on a click in the last minutes of the token, before it runs out', async () => {
		const renewed = vi.fn();
		auth = new GisAuth('id', renewed);
		await auth.prepare();
		const first = auth.signIn('consent');
		gis.grant();
		await first;

		vi.advanceTimersByTime(30 * 60_000);
		click();
		expect(gis.requests).toHaveLength(1);

		vi.advanceTimersByTime(16 * 60_000);
		await expect(auth.getToken()).resolves.toBe('tok');
		click();
		expect(gis.requests).toEqual([{ prompt: 'consent' }, { prompt: '' }]);
		gis.grant();
		await vi.waitFor(() => expect(renewed).toHaveBeenCalledOnce());
	});

	it('does not reopen the popup after signing out', async () => {
		auth = new GisAuth('id');
		await auth.prepare();
		const first = auth.signIn('consent');
		gis.grant();
		await first;
		vi.advanceTimersByTime(46 * 60_000);
		await auth.signOut();
		click();
		expect(gis.requests).toHaveLength(1);
	});
});
