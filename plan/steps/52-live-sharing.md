# Step 52 — Live sharing (peer-to-peer)

Phase: L. Sync · Depends on: 49 · Estimate: 2.5 days

> **Approved by the human (2026-10-09):** live co-editing between browsers through WebRTC, with a tiny signaling relay of our own (free Cloudflare account) that stores nothing; `meta.share = { room, key }` in the board doc (data model); edit links only; images up to 5 MB sent between browsers. Can run before step 50: it needs no Google setup.

## Goal
"Share" on a board copies a link. Anyone who opens it edits the same board live with everyone who has it open. Each person keeps their own copy (and, with Drive sync on, it lands in their own Drive). Nothing is stored on a server.

## Design
- **Transport:** `y-webrtc` (`WebrtcProvider`) on the board's `Y.Doc`, wired in `openBoard()` when `meta.share` is set (and unwired when it's removed, live). Peer updates use the provider as origin: not `LOCAL` (no undo), saved by `BoardSaver`, reported dirty to Drive sync, forwarded to other tabs.
- **Room and key:** `meta.share = { room, key }`, both random (`nanoid(16)`, `nanoid(24)`). The provider joins room `spacy-<room>` with `password: key` (signaling messages are encrypted with it; the WebRTC data channel is encrypted by DTLS).
- **Link:** `/board/<id>#live=<room>.<key>`. The key is in the hash, so it never reaches any server. Opening a link: if the board isn't in the list, it's created with that id (title "Shared board" until the content arrives), `meta.share` is set, and the hash is removed from the address bar.
- **Signaling relay** (`relay/`): a Cloudflare Worker + one Durable Object that speaks y-webrtc's signaling protocol (`subscribe`, `unsubscribe`, `publish`, `ping`/`pong`), with WebSocket hibernation, no storage. Deployed by the human with `wrangler deploy` on a free account. Development and e2e use y-webrtc's own Node relay (`node_modules/y-webrtc/bin/server.js`).
- **Configuration:** `PUBLIC_SIGNALING_URLS` (comma-separated `wss://` URLs) at build time. Without it the Share button is hidden. `postbuild-csp.mjs` adds those origins to `connect-src`.
- **Images:** a second provider room `spacy-<room>-assets` on a session-only `Y.Doc`: `wants` (asset ids someone is missing) and `files` (asset id → `{ mime, w, h, data }`). A peer that has a wanted image ≤ 5 MB puts it in `files`; the asker stores it (`assetsRepo.putSynced`) and removes both entries. The live session answers the tab's image requests through the hub like Drive sync does; `requestAsset` resolves true on the first success and false only after every responder said no.
- **UI:** a "Share" button in the top bar opens a popover: "Anyone with the link can edit this board" · the link with "Copy link" · "Stop sharing" (removes `meta.share`: everyone disconnects). A small "Live" indicator with the number of people connected.

## Tasks
1. `storage/live/`: `share.ts` (meta helpers, link parse/format), `session.ts` (provider lifecycle on an open board, follows `meta.share`), `liveAssets.ts` (the image exchange).
2. `openBoard` wiring; join-from-link in `BoardPage` before opening.
3. `requestAsset` with several responders.
4. Share popover, live indicator.
5. `relay/` Worker + README section "Live sharing relay"; the CSP build step; the local relay for dev/e2e.

## Tests
- `share.test.ts`: link round trip, malformed hashes rejected, meta helpers.
- `liveAssets.test.ts`: two session docs linked in memory: a wanted image is sent, stored and the request answered; over 5 MB is not sent.
- `hub` test: several responders, first success wins, false only when all said no.
- e2e `live.spec.ts` (local relay): A shares → B opens the link in another context → a sticky made by B appears on A and the other way round; an image on A shows on B; "Stop sharing" disconnects B.

## Acceptance criteria
- [x] `pnpm verify` and `pnpm test:e2e` pass (e2e: `live.spec.ts` on Chromium; full run at the end of the branch)
- [x] `00-architecture.md`: §5 `meta.share`, §14 live sharing

## Out of scope
Presence (step 53). Accounts, view-only links, a TURN relay for strict networks.

## Commit
`feat(live): share a board live between browsers`
