/** Signaling relays for live sharing (`PUBLIC_SIGNALING_URLS` at build time). Empty: sharing is off. */
export const SIGNALING_URLS: readonly string[] = __SIGNALING_URLS__
	.split(',')
	.map((u) => u.trim())
	.filter((u) => /^wss?:\/\//.test(u));

export const liveSharingAvailable = (): boolean => SIGNALING_URLS.length > 0;
