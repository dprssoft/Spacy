import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GisAuth } from './gisAuth';

type Req = { prompt?: string; login_hint?: string };

// gisAuth loads Google's script once per module, so every test shares one stub.
const gis = {
	requests: [] as Req[],
	callback: (() => {}) as (r: { access_token?: string; expires_in?: number }) => void,
	error: (() => {}) as (e: { type?: string }) => void,
	grant() {
		this.callback({ access_token: 'tok', expires_in: 3600 });
	}
};
(globalThis as { google?: unknown }).google = {
	accounts: {
		oauth2: {
			initTokenClient(c: { callback: typeof gis.callback; error_callback: typeof gis.error }) {
				gis.callback = c.callback;
				gis.error = c.error_callback;
				return { callback: c.callback, requestAccessToken: (o: Req) => gis.requests.push(o) };
			},
			revoke() {}
		}
	}
};

const click = () => document.dispatchEvent(new Event('click'));

async function signedIn(auth: GisAuth): Promise<void> {
	await auth.prepare();
	const first = auth.signIn('consent');
	gis.grant();
	await first;
}

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

		vi.advanceTimersByTime(50 * 60_000);
		click();
		expect(gis.requests).toHaveLength(1);

		vi.advanceTimersByTime(6 * 60_000);
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
		vi.advanceTimersByTime(56 * 60_000);
		await auth.signOut();
		click();
		expect(gis.requests).toHaveLength(1);
	});

	it('never opens the popup on pointerdown or a key press, only once a click is done', async () => {
		auth = new GisAuth('id');
		await signedIn(auth);
		vi.advanceTimersByTime(56 * 60_000);
		document.dispatchEvent(new Event('pointerdown'));
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
		expect(gis.requests).toHaveLength(1);
		click();
		expect(gis.requests).toHaveLength(2);
	});

	it('after a failed renewal, stops reopening the popup and asks to sign in again', async () => {
		const failed = vi.fn();
		auth = new GisAuth(
			'id',
			() => {},
			() => null,
			failed
		);
		await signedIn(auth);
		vi.advanceTimersByTime(59 * 60_000);
		click();
		gis.error({ type: 'popup_closed' });
		await vi.waitFor(() => expect(failed).toHaveBeenCalledOnce());

		await expect(auth.getToken()).rejects.toThrow();
		click();
		expect(gis.requests).toHaveLength(2);

		// "Sign in again" works, and clicks renew by themselves again after it.
		const again = auth.signIn('');
		gis.grant();
		await again;
		vi.advanceTimersByTime(56 * 60_000);
		click();
		expect(gis.requests).toHaveLength(4);
	});

	it('one popup when a renewing click is also the click on "Sign in again"', async () => {
		auth = new GisAuth('id');
		await signedIn(auth);
		vi.advanceTimersByTime(59 * 60_000);
		await expect(auth.getToken()).rejects.toThrow();
		click();
		const manual = auth.signIn('');
		expect(gis.requests).toHaveLength(2);
		gis.grant();
		await manual;
	});
});
