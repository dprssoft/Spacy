// Live sharing finds the other browsers through public Nostr relays (Trystero), so it needs no
// server of ours. `PUBLIC_LIVE_RELAY_URLS` (comma-separated ws:// or wss:// URLs, build time)
// switches to Trystero's own WebSocket relay instead: e2e tests and private networks.
export const LIVE_RELAY_URLS: readonly string[] = __LIVE_RELAY_URLS__
	.split(',')
	.map((u) => u.trim())
	.filter((u) => /^wss?:\/\//.test(u));

export const LIVE_APP_ID = 'spacy-live';

export interface TurnServer {
	urls: string[];
	username: string;
	credential: string;
}

/**
 * TURN servers relay WebRTC traffic when two browsers can't connect directly (mobile carriers,
 * strict NATs: typically peers in different cities). The STUN servers Trystero uses by default
 * only help when a direct path exists.
 */
export function parseTurnConfig(raw: {
	urls: string;
	username: string;
	credential: string;
}): TurnServer[] {
	const urls = raw.urls
		.split(',')
		.map((u) => u.trim())
		.filter((u) => /^turns?:/.test(u));
	return urls.length ? [{ urls, username: raw.username, credential: raw.credential }] : [];
}

export const LIVE_TURN_CONFIG: readonly TurnServer[] = parseTurnConfig(__LIVE_TURN__);
