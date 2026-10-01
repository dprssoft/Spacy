// Ambient types for the service worker registration module provided by vite-plugin-pwa.
declare module 'virtual:pwa-register' {
	/** Provided by vite-plugin-pwa. Returns a function that activates the waiting worker. */
	export function registerSW(options?: {
		immediate?: boolean;
		onNeedRefresh?: () => void;
		onOfflineReady?: () => void;
		onRegisterError?: (error: unknown) => void;
	}): (reloadPage?: boolean) => Promise<void>;
}
