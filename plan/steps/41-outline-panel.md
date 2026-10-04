# Step 41 — Outline panel

Phase: K. Writers · Depends on: 39 · Estimate: 1.5 days

> **Approved by the human (2026-10-04):** stores the manuscript order in `meta.outline` (see below).

## Goal
A side panel, shown or hidden with a toggle, that lists the page's doc cards as a manuscript: grouped by frame (chapters → scenes), in a reading order you can drag to change, with word counts. Click to jump to a card. This order is what compile (step 42) uses.

## Proposed data model (for approval)
`meta.outline: Record<pageId, string[]>` — the doc card ids of a page in manuscript order (JSON in the existing `meta` map, written with `LOCAL`, undoable). Cards missing from the list follow in reading order (frames left→right/top→bottom, then cards inside them the same way; cards outside frames last); ids of deleted cards are ignored. No schema bump: older apps ignore the key.

## Tasks
1. `doccards/outline.ts` (pure): `outlineOrder(cards, frames, stored) → { chapters: { frame | null; cards }[] }`, reading-order fallback, `moveInOutline(order, id, toIndex, toChapter)`.
2. `OutlinePanel.svelte` (right side on desktop/tablet, a bottom sheet on phones): chapters (frame titles, collapsible) with their cards (title, word count, first line), totals per chapter and for the page; drag to reorder (also between chapters: moving a card into another chapter moves it into that frame on the board, keeping its size, as one undo step); keyboard reorder (Alt+↑/↓); click → select the card and fly to it; double-click → focus mode.
3. Toggle: a toolbar/status bar button "Outline", shortcut **Mod+Shift+O**, remembered per board (`localPrefs`). The panel resizes the canvas (it isn't drawn over it).
4. Live: cards created, renamed, edited or deleted (here or in another tab) update the panel.

## Tests
- `outline.test.ts`: reading order, stored order with missing/deleted ids, moves within and across chapters.
- e2e `outline.spec.ts`: insert "Scene cards" → panel shows 3 chapters × 4 → drag a scene to chapter 2 → it moves into that frame and the order persists after reload; undo restores; Mod+Shift+O toggles; click flies to the card; phones show it as a sheet.

## Acceptance criteria
- [x] `pnpm verify` and `pnpm test:e2e` pass
- [x] `00-architecture.md` §5 documents `meta.outline`

## Commit
`feat(writing): outline panel with manuscript order, word counts and drag to reorder`
