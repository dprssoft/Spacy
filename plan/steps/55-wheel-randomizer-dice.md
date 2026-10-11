# Step 55 — Wheel of fortune, randomizer, dice

Phase: M. Widgets · Depends on: 54 · Estimate: 2 days

## Goal
Three chance widgets for workshops and games: a **wheel of fortune**, a **randomizer** (pick, shuffle, split into teams) and **dice** (with a coin). Everyone on a live board sees the same spin and the same result.

## Read first
- Step 54 and its `PROGRESS.md` entry; `src/lib/board/widgets/{catalog.ts, timer/*}`
- `src/lib/board/selection.svelte.ts`, `src/lib/model/ops.ts` (creating stickies), `src/lib/shared/palettes.ts`

## Shared randomness
`widgets/random.ts`: a seeded PRNG (`mulberry32`) and helpers `pick`, `shuffle` and `teams`. A seed is 32 bits from `crypto.getRandomValues`. A result is never stored on its own: state stores `{ seed, at }` and every client derives the same result from the seed and the config **as it was at `at`**. To make that hold, the derived result is also written into state when the animation starts.

## Tasks
1. **Wheel** (Facilitation):
   - Config: `{ segments: { label: string; color: string }[] /* 2..60, label ≤ 60 */, removeWinner: boolean, duration: number /* s, 2..10, default 4 */ }`. The default is 6 segments "Option 1"–"Option 6" in palette colors.
   - State: `{ spin: { seed: number; at: number; winner: number; turns: number } | null, removed: number[], history: string[] /* last 10 */ }`.
   - View: an SVG wheel with labels (ellipsized) and a fixed pointer at the top. The spin is an ease-out rotation that lands on `winner`; a peer who joins mid-spin sees the rest of it. Afterwards a banner shows the winner, and with `removeWinner` that segment is greyed out from the next spin (until "Reset"). Reduced motion: a 300 ms fade to the result instead of rotating.
   - Actions: Spin (primary; disabled while spinning or when fewer than 2 segments are left), Reset.
   - Settings: a segment list (add, remove, reorder, rename, color), "Use selected" (takes the text of the selected stickies, shapes and text; empty text is skipped; it replaces the segments), presets "Yes / No", "1–10", "Team members" (empty labels to fill in), remove winner, duration.
   - Context menu on a multi-selection with text: "Make a wheel from selection". It places the wheel to the right of the selection.
2. **Randomizer** (Facilitation):
   - Config: `{ items: string[] /* ≤ 200, ≤ 100 chars */, mode: 'pick' | 'shuffle' | 'teams', count: number /* pick: how many; teams: how many teams */ }`.
   - State: `{ draw: { seed: number; at: number; result: string[][] } | null }`.
   - View: the item count, and after a draw the result as a list (pick, shuffle) or as columns (teams), with a short shuffle animation (none with reduced motion).
   - Actions: Draw (primary), "Place as stickies". The latter creates stickies from the result next to the widget, one column per team, as one LOCAL undo step.
   - Settings: an items textarea (one per line), "Use selected", mode, count.
3. **Dice** (Facilitation):
   - Config: `{ count: number /* 1..6 */, sides: 2 | 4 | 6 | 8 | 10 | 12 | 20 }` (sides 2 = coins, drawn as heads/tails).
   - State: `{ roll: { seed: number; at: number; values: number[] } | null }`.
   - View: d6 as pip faces, other sides as a polygon with the number, coins as a disc; a 600 ms tumble (none with reduced motion), then the total.
   - Actions: Roll (primary).
4. Add all three to the Widgets dropdown under **Facilitation**. Results are announced through `LiveAnnouncer` ("Wheel: Alice").

## Files
- create: `src/lib/board/widgets/random.ts` (+ test), `src/lib/board/widgets/{wheel,randomizer,dice}/*` (view, settings, pure logic + test each)
- modify: `widgets/catalog.ts`, `ui/CanvasContextMenu.svelte`

## Tests
- `random.test.ts`: same seed → same pick/shuffle/teams; teams are balanced (sizes differ by ≤ 1); every item appears exactly once.
- `wheel.test.ts`: the rotation angle lands the winner under the pointer for 2, 7 and 60 segments; removed segments are never won; mid-spin angle at `t`.
- `dice.test.ts`: values stay within 1..sides.
- e2e in `widgets.spec.ts`: select three stickies → "Make a wheel from selection" → Spin → a winner banner with one of the three texts; the randomizer in teams mode → "Place as stickies" → one undo removes them all. Live: B sees the same wheel winner as A.

## Acceptance criteria
- [ ] `pnpm verify` and `pnpm test:e2e` pass
- [ ] Two peers spinning the same wheel see the same winner
- [ ] Reduced motion: no rotation or tumble

## Out of scope
Weighted segments, images on segments, sounds, spin history export.

## Commit
`feat(widgets): wheel of fortune, randomizer and dice`
