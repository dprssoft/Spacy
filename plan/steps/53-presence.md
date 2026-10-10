# Step 53 — Presence: names and live cursors

Phase: L. Sync · Depends on: 52 · Estimate: 1 day

## Goal
While a board is shared, everyone sees who else is there and where their pointer is.

## Design
- **Awareness** (`y-protocols`, carried by the step 52 provider): `{ user: { name, color }, cursor: { x, y, page } | null }`. The pointer position is in world units, sent at most every 50 ms, `null` when the pointer leaves the board.
- **Name:** the comment author name (`spacy:commentAuthor`); if empty, "Guest" plus a short number. A color from the sticky palette, picked from the client id.
- **Cursors:** a screen-space layer (`board/live/LiveCursors.svelte`) under the floating UI: an arrow and a name label per peer on the current page, moved with the viewport.
- **Avatars:** in the top bar next to Share: one colored initial per peer (up to 4, then "+N"), the name as tooltip.

## Tasks
1. `board/live/presence.svelte.ts`: reactive peer list from awareness; local state updates (throttled).
2. `LiveCursors.svelte`, avatars in the top bar.
3. Name and color helpers.

## Tests
- `presence.test.ts`: two awareness instances linked in memory: name/color/cursor arrive; leaving clears; throttle.
- e2e in `live.spec.ts`: B's pointer moving shows B's cursor with its name on A.

## Acceptance criteria
- [ ] `pnpm verify` and `pnpm test:e2e` pass

## Commit
`feat(live): show who is on a shared board and their cursors`
