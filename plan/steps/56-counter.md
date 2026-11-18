# Step 56 — Counter

Phase: M. Widgets · Depends on: 54 · Estimate: 1 day

(Dot voting, originally part of this step, is archived: `plan/archive/dot-voting.md`.)

## Goal
**Counter**: a team tally that several people can click at once without losing counts.

## Read first
- Step 54 and its `PROGRESS.md` entry; `src/lib/model/widgets.ts` (entries map), `src/lib/board/live/presence.svelte.ts`

## Tasks
1. **Counter** (Team):
   - Config: `{ step: number /* default 1 */, min: number | null, max: number | null, target: number | null }`.
   - Value = `base + Σ entries[participantId].delta`, where `base` is in state (`{ base: number }`). Each click adds to the clicker's own delta (no lost increments). Reset sets `base = 0` and clears the entries in one transaction.
   - View: a big number with − / + buttons and an optional target bar ("7 / 10").
   - Actions: + (primary), −, Reset. A click outside min/max is ignored.
2. Add it to the Widgets dropdown under **Team**.

## Files
- create: `src/lib/board/widgets/counter/*` (view, settings, pure logic + test)
- modify: `widgets/catalog.ts`

## Tests
- `counter.test.ts`: two participants incrementing concurrently on two Y.Docs synced afterwards → the sum of both; min/max; reset.
- e2e: + three times, − once → 2; with live sharing, A and B click + at the same time and both see the sum.

## Acceptance criteria
- [ ] `pnpm verify` and `pnpm test:e2e` pass
- [ ] Concurrent counter clicks from two peers are never lost

## Out of scope
Dot voting (archived), counter history or export.

## Commit
`feat(widgets): a shared counter`
