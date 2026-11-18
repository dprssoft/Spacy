# Archived — Dot voting

Archived 2026-11-18 by the human ("archive voting plans for now"). Not scheduled. It was part of step 56 (which keeps the counter) and step 60 (the "Lean coffee" template). To bring it back, make it a new step after 56, and restore Lean coffee in step 60.

Depends on: 54 (widget framework), 56 (counter: creates `spacy:participantId` and uses the `widgets` entries map) · Estimate: 1.5 days

## Goal
Each person gets a number of dots to put on stickies and other objects; the totals stay hidden until revealed.

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
2. Add it to the Widgets dropdown under **Team**.

## Files
- create: `src/lib/board/widgets/vote/*` (view, settings, pure logic + test), `src/lib/board/widgets/vote/{VotingBanner.svelte, VoteDots.svelte, votingMode.svelte.ts}`
- modify: `widgets/catalog.ts`, `tools/select.svelte.ts` (hands clicks to voting mode), `canvas/SelectionOverlay.svelte` or the board workspace (mounts the dots layer), `00-architecture.md` (voting rule)

## Tests
- `vote.test.ts`: dots left; `maxPerItem`; out-of-scope elements rejected; totals and ranking with ties (by id); deleted elements are dropped from totals.
- e2e: start voting → put 3 dots on two stickies → "2 of 5 left" → reveal → the top list shows them in order; undo doesn't remove votes. Live: A and B each vote, and both see the totals after reveal.

## Acceptance criteria
- [ ] `pnpm verify` and `pnpm test:e2e` pass
- [ ] Concurrent votes from two peers are never lost
- [ ] Votes stay hidden from others until reveal

## Out of scope
Anonymous voting guarantees (entries are readable in the Y.Doc), planning-poker cards, vote export, timed voting (put a timer next to it).

## Also archived from step 60
- **Lean coffee** (Workshops template): To discuss / Discussing / Done frames, dot voting scoped to "To discuss", and a 5-minute timer.
- Its e2e: new board from "Lean coffee" → Start voting → vote on a sticky in "To discuss" works, and one outside it doesn't.

## Commit
`feat(widgets): dot voting`
