// Google sign-in for Drive sync with Google Identity Services' token model: an access token
// (about an hour) obtained in a popup, kept in memory only and shared with this browser's other
// tabs. There is no refresh token without a backend, so renewal needs Google's popup, and popups
// need a user gesture: in the token's last minutes the next click or key press renews it, before
// sync has to wait ("Sign in again"). With earlier consent and the account as a hint, the popup
// closes by itself.
import { AuthRequiredError, type SyncAuth } from '$lib/storage/sync/auth';
import { DRIVE_SCOPE, GIS_SRC } from './config';

interface TokenResponse {
	access_token?: string;
	expires_in?: number | string;
	error?: string;
}
interface TokenClient {
	callback: (r: TokenResponse) => void;
	error_callback?: (e: { type?: string }) => void;
	requestAccessToken(opts?: { prompt?: string; login_hint?: string }): void;
}
interface Gis {
	accounts: {
		oauth2: {
			initTokenClient(c: {
				client_id: string;
				scope: string;
				callback: (r: TokenResponse) => void;
				error_callback?: (e: { type?: string }) => void;
			}): TokenClient;
			revoke(token: string, done?: () => void): void;
		};
	};
}

type Token = { value: string; expiresAt: number };
type Message = { type: 'token'; token: Token | null } | { type: 'token-request' };

const MARGIN_MS = 5 * 60_000;
/** How long before the token stops being used that a click renews it. */
const RENEW_AHEAD_MS = 10 * 60_000;
let gisLoad: Promise<Gis> | null = null;

function loadGis(): Promise<Gis> {
	gisLoad ??= new Promise((resolve, reject) => {
		const existing = (globalThis as { google?: Gis }).google;
		if (existing?.accounts?.oauth2) return resolve(existing);
		const s = document.createElement('script');
		s.src = GIS_SRC;
		s.async = true;
		s.onload = () => {
			const g = (globalThis as { google?: Gis }).google;
			if (g?.accounts?.oauth2) resolve(g);
			else reject(new Error('Google sign-in didn’t load'));
		};
		s.onerror = () => {
			gisLoad = null;
			reject(new Error('Google sign-in didn’t load'));
		};
		document.head.append(s);
	});
	return gisLoad;
}

export class GisAuth implements SyncAuth {
	#token: Token | null = null;
	#client: TokenClient | null = null;
	#pending: { resolve: () => void; reject: (e: Error) => void } | null = null;
	#disarm: (() => void) | null = null;
	#renewTimer: ReturnType<typeof setTimeout> | undefined;
	readonly #channel =
		typeof BroadcastChannel === 'function' ? new BroadcastChannel('spacy-sync-auth') : null;

	constructor(
		private readonly clientId: string,
		/** A token arrived after sync had to wait for one. */
		private readonly onRenewed: () => void = () => {},
		/** The account to sign in with, so Google skips its account chooser. */
		private readonly loginHint: () => string | null = () => null
	) {
		this.#channel?.addEventListener('message', (e: MessageEvent<Message>) => {
			if (e.data?.type === 'token-request') {
				if (this.#valid()) this.#channel?.postMessage({ type: 'token', token: this.#token });
				return;
			}
			if (e.data?.type !== 'token') return;
			const waiting = !this.#valid();
			this.#setToken(e.data.token);
			if (waiting && this.#valid()) this.onRenewed();
		});
		// A tab opened later borrows the token another tab already has.
		this.#channel?.postMessage({ type: 'token-request' } satisfies Message);
	}

	/** Loads Google's script ahead of a click, so the popup can open within that click. */
	async prepare(): Promise<void> {
		const gis = await loadGis();
		this.#client ??= gis.accounts.oauth2.initTokenClient({
			client_id: this.clientId,
			scope: DRIVE_SCOPE,
			callback: (r) => this.#onToken(r),
			error_callback: (e) =>
				this.#fail(new Error(e.type === 'popup_closed' ? 'Sign-in was closed' : 'Sign-in failed'))
		});
	}

	/** Opens Google's popup. Call from a click (`prompt: 'consent'` for the first connection). */
	signIn(prompt: '' | 'consent' = ''): Promise<void> {
		if (!this.#client) return Promise.reject(new Error('Call prepare() first'));
		const client = this.#client;
		const hint = this.loginHint();
		return new Promise((resolve, reject) => {
			this.#pending = { resolve, reject };
			client.requestAccessToken(hint ? { prompt, login_hint: hint } : { prompt });
		});
	}

	async getToken(opts: { force?: boolean } = {}): Promise<string> {
		if (opts.force) this.#setToken(null);
		if (this.#valid()) return this.#token!.value;
		this.renewOnNextGesture();
		throw new AuthRequiredError();
	}

	async signOut(): Promise<void> {
		const t = this.#token;
		this.#setToken(null);
		this.#disarm?.();
		this.#channel?.postMessage({ type: 'token', token: null } satisfies Message);
		if (t) (await loadGis()).accounts.oauth2.revoke(t.value);
	}

	destroy(): void {
		clearTimeout(this.#renewTimer);
		this.#disarm?.();
		this.#channel?.close();
	}

	#valid(): boolean {
		return !!this.#token && this.#token.expiresAt - MARGIN_MS > Date.now();
	}

	#fresh(): boolean {
		return !!this.#token && this.#token.expiresAt - MARGIN_MS - RENEW_AHEAD_MS > Date.now();
	}

	#setToken(token: Token | null): void {
		this.#token = token;
		clearTimeout(this.#renewTimer);
		if (!token) return;
		const wait = token.expiresAt - MARGIN_MS - RENEW_AHEAD_MS - Date.now();
		this.#renewTimer = setTimeout(() => this.renewOnNextGesture(), Math.max(0, wait));
	}

	/** Renews within the person's next click or key press, when the browser allows a popup. */
	renewOnNextGesture(): void {
		if (this.#disarm || !this.#client || typeof document === 'undefined') return;
		const disarm = () => {
			document.removeEventListener('pointerdown', renew, true);
			document.removeEventListener('keydown', renew, true);
			this.#disarm = null;
		};
		const renew = () => {
			disarm();
			// Another tab may have renewed it in the meantime.
			if (!this.#fresh()) void this.signIn('').then(this.onRenewed, () => {});
		};
		document.addEventListener('pointerdown', renew, true);
		document.addEventListener('keydown', renew, true);
		this.#disarm = disarm;
	}

	#onToken(r: TokenResponse): void {
		if (!r.access_token) return this.#fail(new Error(r.error ?? 'Sign-in failed'));
		this.#setToken({
			value: r.access_token,
			expiresAt: Date.now() + Number(r.expires_in ?? 3600) * 1000
		});
		this.#channel?.postMessage({ type: 'token', token: this.#token } satisfies Message);
		this.#pending?.resolve();
		this.#pending = null;
	}

	#fail(err: Error): void {
		this.#pending?.reject(err);
		this.#pending = null;
	}
}
