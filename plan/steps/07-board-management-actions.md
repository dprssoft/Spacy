# Step 07 — Board management actions

Phase: B. Start page · Depends on: 06 · Estimate: 1.5 days

## Goal
Star, rename, duplicate, trash/restore/delete forever; search, sort and grid/list layout; keyboard navigation of cards; toasts with undo; E2E in CI.

## Read first
- `src/lib/home/*`, `src/lib/storage/boardsRepo.ts`, `src/lib/storage/boardLifecycle.ts`, `src/lib/storage/boardDoc.ts`

## Tasks
1. Install `pnpm add svelte-sonner`. Add `<Toaster richColors position="bottom-center" />` to `+layout.svelte`, themed through `theme.resolved`.
2. `src/lib/shared/ui/InlineEditable.svelte`: props `value`, `onCommit(newValue)`, `editing` (bindable), `class`, `ariaLabel`. It shows text or an `<input>`. Enter or blur commits the trimmed value; empty → revert; Escape cancels. The input auto-focuses and selects all.
3. **Star toggle** on `BoardCard`: a star icon button top-right on the thumbnail, visible on hover or focus, always visible when starred (filled amber). It calls `boardsRepo.setStarred` and `preventDefault`s the link navigation.
4. **Card menu** `src/lib/home/BoardCardMenu.svelte` (bits-ui `DropdownMenu`, trigger = "⋯" icon button with `aria-label="Board actions"`):
   - Normal views: Open · Open in new tab (`window.open(href, '_blank')`) · Rename · Duplicate · Export (disabled, tooltip "Coming soon"; step 27) · separator · Move to trash (danger color)
   - Trash view: Restore · Delete forever (danger)
5. **Rename:** from the menu or double-click on the title → `InlineEditable` in the card body → `boardsRepo.rename`.
6. **Duplicate:** `duplicateBoard(id)` → toast "Board duplicated".
7. **Trash:** `boardsRepo.trash(id)` → toast "Moved to trash" with an action "Undo" → `restore(id)`.
8. **Delete forever:** bits-ui `AlertDialog` ("Delete “{title}” forever? This can't be undone.") → `destroyBoard(id)`. In the trash view, a header button "Empty trash" with the same confirm deletes all.
9. In the trash view, cards are not links. Clicking one shows a toast "Restore the board to open it".
10. **Toolbar** above the grid (`src/lib/home/GridToolbar.svelte`):
    - Search: wire the header search input to `query.query` with a 150 ms debounce. Clear button (×). `/` focuses search when not typing elsewhere.
    - Sort `Select` (bits-ui): Last opened · Last edited · Date created · Name. Hidden in the Recent view (always last opened). Persist in `localPrefs` key `home:sort`.
    - Layout toggle grid/list (icons LayoutGrid / List), persisted as `home:layout`.
11. **List layout** `src/lib/home/BoardListRow.svelte`: a table-like row with a 64×40 thumbnail, title, "Edited …", "Created {date}", star and menu. Same actions as the card.
12. **Keyboard navigation** (`src/lib/home/gridNav.ts`, used as an attachment or action on the grid container): roving tabindex over cards; arrow keys move focus (compute columns from `getComputedStyle(grid).gridTemplateColumns`); Home/End; Enter opens; F2 renames; Delete trashes (in trash: Delete → the delete-forever dialog).
13. Call `purgeExpiredTrash()` (from `boardLifecycle`) once on HomePage mount.
14. Search with no results → EmptyState "No boards match “{query}”".
15. **CI:** add an `e2e` job to `.github/workflows/ci.yml` (depends on install; `pnpm exec playwright install --with-deps chromium`; `pnpm test:e2e`; upload `playwright-report` as an artifact on failure).

## Files
- create: `src/lib/shared/ui/InlineEditable.svelte`, `src/lib/home/{BoardCardMenu.svelte, GridToolbar.svelte, BoardListRow.svelte, gridNav.ts, ConfirmDialog.svelte}`
- modify: `BoardCard.svelte`, `BoardGrid.svelte`, `HomePage.svelte`, `HomeHeader.svelte`, `+layout.svelte`, `ci.yml`

## Tests
- `gridNav.test.ts`: index math for arrows given a column count and item count (pure function `nextIndex(current, key, cols, count)`).
- `tests/e2e/home.spec.ts` (extend): create 3 boards → rename one via the menu → star it → it appears in Starred → duplicate it ("(copy)" appears) → trash it → the toast Undo restores it → trash again → Trash view shows it → Restore → trash again → Delete forever → it's gone from Trash. Search filters by title. Sort by name orders alphabetically. The layout toggle switches to list and persists after reload.

## Acceptance criteria
- [ ] `pnpm verify` and `pnpm test:e2e` pass; the CI workflow has an e2e job
- [ ] Every action works by keyboard alone (manual check; note it in PROGRESS)
- [ ] Two tabs on the start page: an action in one updates the other within 1 s

## Out of scope
Export (step 27), templates (step 28), settings menu (step 29).

## Commit
`feat(home): add board actions, trash, search, sort, list layout and keyboard navigation`
