// Access tokens for a remote store. The web app uses Google Identity Services (`$lib/sync/gisAuth`);
// the phone app (step 51) plugs in a native sign-in behind the same interface.

export interface SyncAuth {
	/** A valid access token. `force`: the last one was rejected, get a new one. */
	getToken(opts?: { force?: boolean }): Promise<string>;
	signOut(): Promise<void>;
}

/** The user has to act (sign in again) before sync can continue. */
export class AuthRequiredError extends Error {
	constructor(message = 'Sign in again to keep syncing') {
		super(message);
		this.name = 'AuthRequiredError';
	}
}
