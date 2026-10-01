// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	interface Window {
		/** Dev/e2e test hooks (see src/lib/dev/testHooks.ts). */
		__smthng?: import('$lib/dev/testHooks').TestHooks;
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
