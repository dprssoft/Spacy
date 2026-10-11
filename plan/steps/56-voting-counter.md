# Step 56 — Dot voting and counter

Phase: M. Widgets · Depends on: 54 · Estimate: 2 days

## Goal
Team decision tools. **Dot voting**: each person gets a number of dots to put on stickies and other objects; the totals stay hidden until revealed. **Counter**: a tally that several people can click at once without losing counts.

## Read first
- Step 54 and its `PROGRESS.md` entry; `src/lib/model/widgets.ts` (entries map), `src/lib/board/live/presence.svelte.ts`
- `src/lib/board/canvas/SelectionOverlay.svelte` (screen-space overlay), `src/lib/board/frameMembership.ts`

## Tasks
1. **Dot voting** (Team):
   - Config: `{ dots: number /* per person, 1..20, default 5 */, maxPerItem: number /* 1..dots, default dots */, scope: 'frame' | 'page', frameId: string | null }`. Scope "frame" means only elements in that frame can be voted on. It is set with "Use selected frame" in the settings, and is the default when the widget is created inside a frame.
   - State: `{ phase: 'setup' | 'voting' | 'revealed' }`. Votes are entries: `widgets[voteId][participantId] = { name, votes: Record<elementId, number> }`. Each person writes only their own entry, so concurrent votes never collide.
   - **Voting mode:** while the phase is `voting`, a banner sits under the top bar: "Voting · 3 of 5 dots left · Done". In voting mode a click on an element in scope (not a connector, frame or widget) adds a dot, and Alt+click (or a click on your own dot) removes one. Selection is paused, but panning and zooming work. "Done" or Escape leaves voting mode; reopen it from the widget ("Vote").
   - Dots are drawn in the screen-space overlay at the element's top-right: your own dots always; everyone's (with totals) once revealed.
   - Widget view: the phase, how many people voted, and how many dots are used. After reveal it shows the top 5 elements by total (each element's text or kind, ellipsized); clicking a row flies to that element.
   - Actions: Start voting / Vote (primary), Reveal, Reset (clears entries, back to setup; confirms first).
   - Without live sharing it still works on one device (one participant), for example to rank your own ideas.
2. **Counter** (Team):
   - Config: `{ step: number /* default 1 */, min: number | null, max: number | null, target: number | null }`.
   - Value = `base + Σ entries[participantId].delta`, where `base` is in state (`{ base: number }`). Each click adds to the clicker's own delta (no lost increments). Reset sets `base = 0` and clears the entries in one transaction.
   - View: a big number with − / + buttons and an optional target bar ("7 / 10").
   - Actions: + (primary), −, Reset. A click outside min/max is ignored.
3. Add both to the Widgets dropdown under **Team**.

## Files
- create: `src/lib/board/widgets/{vote,counter}/*` (view, settings, pure logic + test each), `src/lib/board/widgets/vote/{VotingBanner.svelte, VoteDots.svelte, votingMode.svelte.ts}`
- modify: `widgets/catalog.ts`, `tools/select.svelte.ts` (hands clicks to voting mode), `canvas/SelectionOverlay.svelte` or the board workspace (mounts the dots layer), `00-architecture.md` (voting rule)

## Tests
- `vote.test.ts`: dots left; `maxPerItem`; out-of-scope elements rejected; totals and ranking with ties (by id); deleted elements are dropped from totals.
- `counter.test.ts`: two participants incrementing concurrently on two Y.Docs synced afterwards → the sum of both; min/max; reset.
- e2e: start voting → put 3 dots on two stickies → "2 of 5 left" → reveal → the top list shows them in order; undo doesn't remove votes. Live: A and B each vote, and both see the totals after reveal.

## Acceptance criteria
- [ ] `pnpm verify` and `pnpm test:e2e` pass
- [ ] Concurrent votes and counter clicks from two peers are never lost
- [ ] Votes stay hidden from others until reveal

## Out of scope
Anonymous voting guarantees (entries are readable in the Y.Doc), planning-poker cards, vote export, timed voting (put a timer next to it).

## Commit
`feat(widgets): dot voting and a shared counter`
