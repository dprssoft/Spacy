// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	/** The app version from package.json (vite `define`). */
	const __APP_VERSION__: string;
	/** Comma-separated live sharing relays, `PUBLIC_SIGNALING_URLS` at build time (vite `define`). */
	const __SIGNALING_URLS__: string;
	/** Google OAuth client id for Drive sync, `PUBLIC_GOOGLE_CLIENT_ID` at build time. */
	const __GOOGLE_CLIENT_ID__: string;

	/** File Handling API (installed PWA opened with `.spacy` files; Chromium). */
	interface LaunchParams {
		readonly files: readonly { getFile(): Promise<File> }[];
	}
	interface LaunchQueue {
		setConsumer(consumer: (params: LaunchParams) => void): void;
	}

	interface Window {
		/** Dev/e2e test hooks (see src/lib/dev/testHooks.ts). */
		__spacy?: import('$lib/dev/testHooks').TestHooks;
		launchQueue?: LaunchQueue;
	}
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		interface PageState {
			/** Set on the history entry pushed when opening a doc card in focus mode. */
			focusPushed?: boolean;
		}
		// interface Platform {}
	}
}

export {};
