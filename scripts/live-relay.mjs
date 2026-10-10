// A local Trystero WebSocket relay for live sharing in development and e2e tests (the app uses it
// when built with PUBLIC_LIVE_RELAY_URLS=ws://localhost:4444). Without that setting the app finds
// peers through public Nostr relays and needs no relay of its own.
import { createWsRelayServer } from '@trystero-p2p/ws-relay/server';

const port = Number(process.env.PORT ?? 4444);
createWsRelayServer({ port });
console.log(`Live sharing relay on ws://localhost:${port}`);
