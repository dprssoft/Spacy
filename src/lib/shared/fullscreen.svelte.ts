// The whole app in full screen (the browser's Fullscreen API). Not every browser allows it for
// a page: iPhone Safari only does it for videos, so the controls hide there.

class FullscreenState {
	active = $state(false);
	readonly supported: boolean;

	constructor() {
		this.supported = typeof document !== 'undefined' && !!document.fullscreenEnabled;
		if (typeof document === 'undefined') return;
		const sync = () => (this.active = document.fullscreenElement !== null);
		document.addEventListener('fullscreenchange', sync);
		sync();
	}

	toggle(): void {
		if (!this.supported) return;
		if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
		else void document.documentElement.requestFullscreen().catch(() => {});
	}
}

export const fullscreen = new FullscreenState();
