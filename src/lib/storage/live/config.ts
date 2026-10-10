// Live sharing finds the other browsers through public Nostr relays (Trystero), so it needs no
// server of ours. `PUBLIC_LIVE_RELAY_URLS` (comma-separated ws:// or wss:// URLs, build time)
// switches to Trystero's own WebSocket relay instead: e2e tests and private networks.
export const LIVE_RELAY_URLS: readonly string[] = __LIVE_RELAY_URLS__
	.split(',')
	.map((u) => u.trim())
	.filter((u) => /^wss?:\/\//.test(u));

export const LIVE_APP_ID = 'spacy-live';
