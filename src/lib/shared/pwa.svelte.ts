import { toast } from 'svelte-sonner';

/** `beforeinstallprompt` (Chromium): lets the app offer its own "Install" action. */
interface InstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

class PwaState {
	canInstall = $state(false);
	#prompt: InstallPromptEvent | null = null;
	#started = false;

	/** Registers the service worker and listens for install/update events. Returns cleanup. */
	init(): () => void {
		const onPrompt = (e: Event) => {
			e.preventDefault();
			this.#prompt = e as InstallPromptEvent;
			this.canInstall = true;
		};
		const onInstalled = () => {
			this.#prompt = null;
			this.canInstall = false;
		};
		window.addEventListener('beforeinstallprompt', onPrompt);
		window.addEventListener('appinstalled', onInstalled);
		if (!this.#started) {
			this.#started = true;
			void this.#register();
		}
		return () => {
			window.removeEventListener('beforeinstallprompt', onPrompt);
			window.removeEventListener('appinstalled', onInstalled);
		};
	}

	async #register(): Promise<void> {
		if (!('serviceWorker' in navigator)) return;
		try {
			const { registerSW } = await import('virtual:pwa-register');
			const update = registerSW({
				// We're past page load already (lazy import), so don't wait for the load event.
				immediate: true,
				// Never reload on our own: a board may be open. The user decides when.
				onNeedRefresh: () =>
					toast('A new version is available', {
						id: 'pwa-update',
						duration: Infinity,
						action: { label: 'Reload', onClick: () => void update(true) }
					}),
				onRegisterError: (err) => console.error('Service worker registration failed', err)
			});
		} catch (err) {
			console.error('Service worker registration failed', err);
		}
	}

	async install(): Promise<void> {
		const prompt = this.#prompt;
		if (!prompt) return;
		this.#prompt = null;
		this.canInstall = false;
		await prompt.prompt();
		await prompt.userChoice.catch(() => undefined);
	}
}

export const pwa = new PwaState();
