# Step 30 — Performance pass

Phase: H. Release · Depends on: 29 · Estimate: 1 day

## Goal
Measure and meet the performance targets. Lazy-load heavy modules and fix any hot paths found by profiling.

## Read first
- `00-architecture.md` §13 (targets)
- `src/lib/dev/perfBoard.ts`, `src/lib/board/boardStore.svelte.ts`, `src/lib/board/canvas/ElementsLayer.svelte`

## Tasks
1. **Realistic perf board:** extend `generatePerfElements` with an option `mixed: true`: 3,000 elements = 1,800 shapes/stickies/texts, 300 strokes (~80 points each), 50 doc cards (with 3 paragraphs each via `setDocContent`), 20 frames, 30 images (reusing one generated asset), 800 connectors between random nearby elements (all routing types). Dev-only button: "Generate mixed perf board".
2. **Render counters (dev only):** `window.__spacy.renderCounts` incremented in `ElementView` (with `$effect` pre-run counting) so you can verify that dragging one element re-renders only it and its connectors. Add a unit or e2e check: drag one element, then the count delta for unrelated ids = 0.
3. **Hot-path checklist** (fix what fails):
   - Pointer moves write to Yjs at most once per frame (`rafBatch` used everywhere: move, resize, rotate, create, bends, label drag).
   - `BoardStore` recomputes `order` only on add/remove/z changes; spatial index updates are incremental.
   - Culling recomputes at most once per frame and uses the expanded rect to avoid thrash while panning.
   - `connectorGeometry` is cached per connector, keyed by (connector snapshot, from snapshot, to snapshot) object identity.
   - Stroke outlines are memoized per element snapshot.
   - Snapping candidate search is capped and uses the index.
4. **Doc cards at low zoom:** when `zoom < 0.4`, or the card is off-screen, render a lightweight preview (title + 3 skeleton lines) instead of mounting a TipTap editor. Mount the editor when zoom ≥ 0.4 and the card is visible. Unmount editors of culled cards.
5. **Lazy loading:**
   - TipTap: `DocCardView` imports `editorFactory` dynamically (`await import(...)`), showing a skeleton while loading. Make sure no other eagerly loaded module imports TipTap (the home bundle must be TipTap-free).
   - Export (`staticSvg`, `exportImage`, the ExportDialog), templates and `fileFormat` are loaded dynamically on first use.
6. **Bundle analysis:** `pnpm add -D rollup-plugin-visualizer`; script `pnpm analyze` (build with the visualizer when `ANALYZE=1`, output `stats.html`, gitignored). Record gzipped sizes of the entry chunks for `/` and `/board/[id]`.
7. **Open time:** add `performance.mark('board-open-start')` in `BoardPage` mount and `performance.measure` after the first `ElementsLayer` render; log it in dev. Measure with a 1,000-element board (cached).
8. Record a results table in `PROGRESS.md`:

   | Metric | Target | Result |
   |---|---|---|
   | Pan, 3k mixed | ≥ 55 fps | |
   | Drag 1 of 3k | ≥ 55 fps | |
   | Open 1k (cached) | < 1 s | |
   | Home JS gz | < 150 KB | |
   | Board JS gz (excl. TipTap) | < 300 KB | |

## Files
- modify: `perfBoard.ts`, `ElementView.svelte`, `DocCardView.svelte`, `ElementsLayer.svelte`, `diagram/geometry.ts`, stroke view, `TopBar.svelte` / export entry points, `vite.config.ts`, `package.json`, `.gitignore`

## Tests
- `tests/e2e/perf-guard.spec.ts` (Chromium, with test hooks): generate 500 mixed elements → drag one element → the render count delta for the others is 0; the home page's loaded scripts don't include a chunk whose name contains `tiptap` or `prosemirror` (check `performance.getEntriesByType('resource')`).

## Acceptance criteria
- [x] `pnpm verify` and `pnpm test:e2e` pass
- [x] All targets met, or deviations documented with measurements and reasons in PROGRESS
- [x] No functional regressions (the full E2E suite passes)

## Out of scope
A Canvas2D renderer rewrite (only if the targets are badly missed; stop and ask the human first).

## Commit
`perf: lazy-load heavy modules, low-zoom doc card previews and render hot-path fixes`
