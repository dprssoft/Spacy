# Spacy live sharing relay

Browsers sharing a board live use this relay only to find each other (WebRTC signaling, the
[y-webrtc](https://github.com/yjs/y-webrtc) protocol). Board content goes directly between the
browsers. Signaling messages are encrypted with the share key, which never leaves the link's `#`
part, so the relay stores nothing and can't read what passes through.

## Deploy (free Cloudflare account)

```bash
cd relay
npx wrangler login
npx wrangler deploy
```

It prints the address, e.g. `https://spacy-relay.<account>.workers.dev`. Build the app with:

```bash
PUBLIC_SIGNALING_URLS=wss://spacy-relay.<account>.workers.dev pnpm build
```

Without `PUBLIC_SIGNALING_URLS` the Share button is hidden.

## Free plan limits

Workers Free allows 100,000 requests a day; a WebSocket message counts as 1/20 of a request. Pings
are answered without waking the relay. Past the limit, new connections fail until 00:00 UTC; you
are never billed without a paid plan.

## Local

`pnpm relay` runs y-webrtc's Node relay on `ws://localhost:4444` (development and e2e tests).
