# Step 06 — Start page layout

Phase: B. Start page · Depends on: 02, 05 · Estimate: 1 day

## Goal
A Figma-like start page: a header, a sidebar with views, a prominent "New board" card, a templates row (empty for now), and a grid of recent boards with thumbnails and "Edited …" times. Clicking "New board" creates a board and opens it.

## Read first
- `00-architecture.md` §4, §6
- `src/lib/home/boards.svelte.ts`, `src/lib/storage/boardsRepo.ts`

## Design

```
┌──────────────────────────────────────────────────────────────────────┐
│ ◆ SMTHNG          [🔍 Search boards…]              [Import] [◐] [⚙] │  header 56px
├────────────┬─────────────────────────────────────────────────────────┤
│ 🕘 Recent  │  ┌─────────────┐ ┌──────────┐ ┌──────────┐              │
│ ★ Starred  │  │     ＋      │ │ template │ │ template │  (step 28)   │
│ ▦ All      │  │  New board  │ └──────────┘ └──────────┘              │
│ 🗑 Trash   │  └─────────────┘                                        │
│            │  Recent                 Sort: Last opened ▾   [▦] [☰]   │
│            │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│            │  │thumbnail │ │thumbnail │ │thumbnail │ │thumbnail │    │
│            │  │Roadmap  ⋯│ │Arch   ⋯  │ │Retro  ⋯  │ │Untitled ⋯│    │
│            │  │Edited 2h │ │Edited 1d │ │Edited 3d │ │Edited 1w │    │
│            │  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
└────────────┴─────────────────────────────────────────────────────────┘
 sidebar 224px
```
- Page background `bg-bg`; cards `bg-surface`, `border border-border`, `rounded-xl`, hover: `shadow-md` and slight lift (`-translate-y-0.5`, 150 ms transition).
- Board grid: `grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))`, `gap-4`.
- Card: thumbnail area `aspect-[16/10]` (`rounded-t-xl`, object-cover), body `p-3`: title (`font-medium`, truncate) and meta line (`text-sm text-muted`: "Edited 2 hours ago").
- "New board" card: same size as a board card, dashed accent border, big `+` icon, label "New board", subtitle "Blank canvas".
- Below 768px the sidebar turns into a horizontal tab row under the header.

## Tasks
1. `src/lib/shared/relativeTime.ts`: `relativeTime(ts: number, now = Date.now(), locale?: string): string` using `Intl.RelativeTimeFormat` (`numeric: 'auto'`), choosing seconds → "just now" (< 45 s), then minutes, hours, days, weeks, months, years.
2. `src/lib/home/placeholderGradient.ts`: `placeholderGradient(id: string): string` returns a CSS `linear-gradient(...)` from two HSL colors derived deterministically from a hash of the id (soft pastel: saturation 60–70%, lightness 80–88%; dark theme handled with CSS opacity).
3. Components in `src/lib/home/`:
   - `HomePage.svelte`: composes everything and owns a `BoardsQuery` (`start()` in `$effect` with cleanup). The view comes from the URL `?view=recent|starred|all|trash` (default recent) via `page.url.searchParams`; switching views uses `goto('?view=...', { keepFocus: true, noScroll: true })`.
   - `HomeHeader.svelte`: logo (inline SVG diamond + "SMTHNG" wordmark), search input placeholder (wired in step 07; render it now, but it may be inert), an Import button (disabled; step 27), `ThemeToggle`, a settings button (disabled; step 29).
   - `Sidebar.svelte`: nav links Recent / Starred / All / Trash with lucide icons (Clock, Star, LayoutGrid, Trash2) and `aria-current="page"` on the active one.
   - `NewBoardCard.svelte`: button. On click: guard against double clicks (`pending` state), `const meta = await boardsRepo.create(); await goto('/board/' + meta.id)`.
   - `TemplatesRow.svelte`: renders `NewBoardCard` followed by template cards from a `templates` prop (empty array for now). Shown only in the Recent and All views.
   - `BoardGrid.svelte`: section title (view name) and the grid of `BoardCard`. Loading → 8 skeleton cards (pulse).
   - `BoardCard.svelte`: `<a href="/board/{id}">` wrapping the thumbnail and body. Thumbnail: if `meta.thumbnail`, an object URL created in `$effect` and revoked in cleanup; else `placeholderGradient(id)`. Reserve a top-right slot for the menu (step 07).
   - `EmptyState.svelte`: icon, title, text and an optional action. Texts: recent/all → "No boards yet" / "Create your first board to get started." + New board button; starred → "No starred boards" / "Star a board to pin it here."; trash → "Trash is empty" / "Deleted boards stay here for 30 days."
4. `src/routes/+page.svelte` renders `<HomePage />`. Set `<svelte:head><title>SMTHNG</title></svelte:head>`.
5. Call `requestPersistentStorage()` once when HomePage mounts.
6. Make the board page placeholder (step 02) show the board title from `boardsRepo.get` so the E2E test can verify navigation. Step 08 replaces it.

## Files
- create: `src/lib/shared/relativeTime.ts`, `src/lib/home/{placeholderGradient.ts, HomePage.svelte, HomeHeader.svelte, Sidebar.svelte, NewBoardCard.svelte, TemplatesRow.svelte, BoardGrid.svelte, BoardCard.svelte, EmptyState.svelte}`, `tests/e2e/helpers.ts`
- modify: `src/routes/+page.svelte`, `src/routes/board/[id]/+page.svelte`

## Tests
- `relativeTime.test.ts`: just now, 5 minutes, 2 hours, yesterday, 3 weeks, 2 years (with a fixed `now` and locale `en`).
- `placeholderGradient.test.ts`: deterministic for the same id, differs for different ids.
- `tests/e2e/helpers.ts`: `resetStorage(page)`, which clears IndexedDB and localStorage via `page.evaluate` before each test.
- `tests/e2e/home.spec.ts`: the empty state is visible on first load → click "New board" → URL matches `/board/[\w-]+` → go back → a card titled "Untitled board" is visible with "Edited just now".

## Acceptance criteria
- [ ] `pnpm verify` and `pnpm test:e2e` pass
- [ ] The layout matches the design in light and dark themes; responsive at 375px, 768px and 1440px (manual check; note it in PROGRESS)
- [ ] Views switch through the URL and the back button works

## Out of scope
Card actions, search, sort and layout toggle (step 07); templates (step 28); import (step 27); settings (step 29); real thumbnails (step 26).

## Commit
`feat(home): add start page with new board card and recent boards grid`
