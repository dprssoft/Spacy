# Step 08 — Board page and top bar

Phase: B. Start page · Depends on: 07 · Estimate: 0.5 day

## Goal
The board route opens the board document, shows loading, not-found and trashed states, and renders a top bar (home, editable title synced both ways, save indicator, export placeholder, theme toggle) above an empty canvas area. **Milestone M1.**

## Read first
- `00-architecture.md` §9 (board context)
- `src/lib/storage/boardDoc.ts`, `src/lib/shared/ui/InlineEditable.svelte`

## Tasks
1. `src/lib/board/context.ts`:
   ```ts
   export interface BoardContext { id: string; doc: Y.Doc; undo: Y.UndoManager; /* extended by later steps */ }
   export function setBoard(ctx: BoardContext): void;   // setContext with a private Symbol key
   export function getBoard(): BoardContext;            // throws if missing
   ```
2. `src/routes/board/[id]/+page.svelte`: `{#key page.params.id}<BoardPage id={page.params.id} />{/key}`.
3. `src/lib/board/BoardPage.svelte`:
   - State: `'loading' | 'ready' | 'notfound' | 'trashed' | 'error'`.
   - On mount: `boardsRepo.get(id)` → missing → notfound; `deletedAt` → trashed (card: "This board is in the trash" + Restore button → `restore` then load + a "Back to boards" link); else `openBoard(id)` → `setBoard(...)` → ready; `boardsRepo.touchOpened(id)`.
   - Because `setContext` must run during component init, render a child `BoardWorkspace.svelte` once ready and pass the `OpenBoard` as a prop; `BoardWorkspace` calls `setBoard` in its script.
   - Cleanup on destroy: `open.close()`.
   - Loading: a centered spinner after 150 ms (avoid flicker). Error: the message + a "Back to boards" link. `NewerSchemaError` → "This board was created with a newer version of SMTHNG."
4. `src/lib/board/BoardWorkspace.svelte`: layout `h-dvh flex flex-col`: `TopBar` + `<main class="relative flex-1 overflow-hidden bg-[var(--canvas-bg)]">` (canvas placeholder, filled in step 09).
5. `src/lib/board/TopBar.svelte` (height 48, `bg-surface border-b border-border`):
   - Left: a home button (logo icon, `aria-label="Back to boards"`, link to `/`), then the title via `InlineEditable` (click to edit).
   - Right: `SaveIndicator`, an Export `DropdownMenu` with disabled items "PNG…", "SVG…", "Download .smthng" (tooltip "Coming soon"), `ThemeToggle`.
6. **Title sync** `src/lib/board/title.svelte.ts`: `class BoardTitle { value = $state('') }` initialized from `meta.title`, observing `getMeta(doc)` for changes from other tabs. `rename(t)`: `setMeta(doc, 'title', t, LOCAL)` + `boardsRepo.rename(id, t)`. On a remote change of `meta.title`, also update `boardsRepo` (idempotent). Set `document.title = `${title} — SMTHNG``.
   - Note: `setMeta` with `LOCAL` is not tracked by the undo manager (its scope is elements only). That's intended.
7. `src/lib/board/SaveIndicator.svelte`: listens to `doc.on('update')` for origin `LOCAL` → shows "Saving…" and switches to "Saved locally" (check icon) 600 ms after the last update. Tooltip: "Boards are saved in this browser. Export a backup to keep a copy."

## Files
- create: `src/lib/board/{context.ts, BoardPage.svelte, BoardWorkspace.svelte, TopBar.svelte, SaveIndicator.svelte, title.svelte.ts}`
- modify: `src/routes/board/[id]/+page.svelte`

## Tests
- `tests/e2e/board-shell.spec.ts`:
  - New board → rename the title in the top bar to "Roadmap" → reload → still "Roadmap" → back home → the card shows "Roadmap".
  - Two pages (same context) on the same board: renaming in one updates the other's title within 1 s.
  - `/board/nope` shows "Board not found" with a link home.
  - A trashed board shows the trashed state; Restore opens it.

## Acceptance criteria
- [x] `pnpm verify` and `pnpm test:e2e` pass
- [x] Navigating home → board → home → board leaks no Y.Docs (close is called; verify with a console log in dev, then remove it)
- [x] **M1 demo:** the start page and board shell work end to end

## Out of scope
Canvas (step 09+), export (steps 26–27).

## Commit
`feat(board): add board page with loading states, top bar and synced title`
