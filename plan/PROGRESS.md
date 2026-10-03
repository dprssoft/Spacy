# Progress log

Append one entry per completed step (newest at the bottom). Keep entries short and factual.

## Template

```
## Step NN — <title> — YYYY-MM-DD
**Summary:** what was built (2–4 bullets)
**Deviations:** differences from the step file and why (or "none")
**Dependencies added:** name@version — reason (or "none")
**Follow-ups:** known gaps, TODOs for later steps (or "none")
**Verification:** pnpm verify ✅ · pnpm test:e2e ✅/n.a. · manual checks done
```

---

<!-- entries below -->

## Step 01 — Scaffold the project — 2026-09-28
**Summary:**
- SvelteKit SPA (adapter-static, `fallback: 'index.html'`, `ssr = false`) with Svelte 5 runes forced on, TypeScript strict + `noUncheckedIndexedAccess` + `noImplicitOverride`, Tailwind v4.
- ESLint (flat config, `no-explicit-any: error`) + Prettier (tabs, single quotes, width 100, svelte + tailwind plugins).
- Vitest (jsdom, fake-indexeddb, jest-dom) with a sanity test; Playwright (Chromium) with a smoke test; `pnpm verify` script; GitHub Actions CI.

**Deviations:**
- `sv` 0.17 generates **no `svelte.config.js`**: SvelteKit/Svelte options (adapter, compilerOptions) live inside `sveltekit({...})` in `vite.config.ts`. Later steps that say "edit `svelte.config.js`" (e.g. step 32 `kit.csp`) must edit that object instead.
- Used `sv create --add prettier eslint tailwindcss sveltekit-adapter=static playwright` instead of manual installs (equivalent result, fewer hand-written configs). Vitest configured manually per the step (the `sv` vitest add-on uses browser mode).
- The scaffold put CSS at `src/routes/layout.css`; moved to `src/app.css` to match the plan (Prettier `tailwindStylesheet` updated).
- Removed the scaffold's `demo` routes and `src/lib/index.ts`.
- Prettier formats Markdown, so `pnpm format` re-aligned tables in `CLAUDE.md`/`AGENTS.md` (content unchanged). `plan/` is in `.prettierignore`.
- Added `packageManager: pnpm@10.34.5` to `package.json` (required by `pnpm/action-setup` in CI).

**Dependencies added:** svelte 5.57, @sveltejs/kit 2.63, vite 8.3, typescript 6.0, tailwindcss 4.3, @sveltejs/adapter-static 3, eslint 10, prettier 3.9, vitest 5.0, jsdom 30, fake-indexeddb 6.2, @testing-library/svelte 5.4, @testing-library/jest-dom 7.0, @playwright/test 1.60 — all per plan.

**Follow-ups:**
- pnpm was not installed on the machine; installed user-locally (`npm i -g pnpm@10 --prefix ~/.local`).
- Playwright warns Fedora is not officially supported (uses the Ubuntu 24.04 fallback build); tests run fine.
- CI e2e job is added in step 07 as planned.

**Verification:** pnpm verify ✅ · pnpm test:e2e ✅ (1 test) · `build/index.html` exists · dev server responds 200 on :5173 · no Svelte 4 syntax in `src/`

## Step 02 — App shell, routing, theme — 2026-09-28
**Summary:**
- Routes: `/` (placeholder home with theme toggle), `/board/[id]` (placeholder), `+error.svelte` (status, message, "Back to boards").
- Theme tokens as CSS variables (light + `[data-theme=dark]`) exposed to Tailwind via `@theme inline` (`bg-surface`, `text-muted`, `border-border`, `bg-accent`, …), `dark:` custom variant, `color-scheme` per theme.
- `localPrefs` (prefixed, try/catch), `ThemeState` runes class (light/dark/system, live OS tracking), no-flash inline script in `app.html`, `ThemeToggle` with bits-ui tooltip; `Tooltip.Provider` in the root layout.

**Deviations:**
- eslint-plugin-svelte enforces `svelte/no-navigation-without-resolve`: internal links use `resolve()` from `$app/paths`. Added this rule to `CLAUDE.md` so later steps follow it (applies to all `href`/`goto`).
- Tailwind color for muted text is named `muted` (class `text-muted`), so token `--color-muted` maps to `--text-muted`; the canvas background token is `--color-canvas` (`bg-canvas`).
- Added an extra e2e test asserting computed colors of `bg-surface` / `border-border` / `text-muted` in both themes (verifies the acceptance criterion instead of a manual check).

**Dependencies added:** bits-ui 2.19.3, @lucide/svelte 1.48.0 — per plan. Icons are imported per-file (`@lucide/svelte/icons/sun`) to keep bundles small.

**Follow-ups:** none

**Verification:** pnpm verify ✅ (6 unit tests) · pnpm test:e2e ✅ (7 tests: smoke, routing ×2, theme ×4 incl. no-flash with app bundle blocked and live OS preference)

## Step 03 — Domain model — 2026-09-28
**Summary:**
- `src/lib/model/`: types (verbatim from architecture §5), Zod 4 schemas with a compile-time guard that schema output ≡ hand-written `Element` type, defaults (palette, sizes, fonts, per-type base styles), ids, fractional z keys, transaction origins, Y.Doc accessors, write ops, cloning, migrations.
- Ops validate the **merged** element with Zod on every create/update and throw `InvalidElementError` (nothing is written on failure); updates write only changed keys (structural compare), so no-op patches emit no Yjs update.
- Extension points for later steps: `beforeDeleteHooks` (may add ids to the delete set — frames, connectors) and `cloneHooks` (connector remapping).

**Deviations:**
- Added helper types to `types.ts` beyond §5 (not stored data): `ElementOf<T>`, `DistributiveOmit`, `NewElement` (element without `z`), `ElementPatch` (partial of any element type).
- `newElementBase(type, id, at, style?)` takes the id explicitly (the step listed `(type, at, style?)`) so callers control ids (needed for clone/paste/templates).
- Added `zManyBelow`, `jsonEqual` (`equal.ts`), `DOC_CARD_HEADER_H`, `CONNECTOR_STUB`, `STICKY_TEXT_COLOR` constants.
- `cloneHooks` receive `NewElement` (clones have no `z`) instead of `Element`.
- Test fixtures live in `src/lib/model/testFixtures.ts` (one valid sample per type); step 19's `elements/fixtures.ts` can build on it.
- Added `pnpm test:coverage` script + coverage config (src/lib, excluding tests/fixtures); listed in `CLAUDE.md`.

**Dependencies added:** yjs 13.6.33, zod 4.6.5, nanoid 6.0.1, fractional-indexing 4.0.0 (per plan); @vitest/coverage-v8 (dev, for the coverage criterion).

**Follow-ups:** parseElement runs on every update — fine now; revisit in step 30 if drag profiling shows it hot.

**Verification:** pnpm verify ✅ (85 unit tests) · model coverage 98.5% statements / 99.4% lines · no Svelte imports in src/lib/model · e2e n.a. (no UI change)

## Step 04 — Metadata and asset storage — 2026-09-28
**Summary:**
- IndexedDB `smthng` v1 via `idb` (typed `DBSchema`): stores `boards` (indexes openedAt/updatedAt/deletedAt) and `assets` (index boardId); `blocking` handler closes the connection so another tab can upgrade.
- `boardsRepo` (get/list with filter+sort+query, create, rename, star, touchOpened/Updated, thumbnail, viewport, trash/restore, destroy, purgeExpiredTrash) and `assetsRepo` (put/get/listByBoard/deleteByBoard/deleteMany/copyToBoard). Mutations are read-modify-write in one IDB transaction; missing ids are no-ops.
- `channels.ts`: board-list change notifications within the tab (EventTarget) and across tabs (one BroadcastChannel per tab, so each listener fires once). Background changes (touchUpdated, thumbnail, viewport) coalesce to ≤ 1 notice/second.
- `persist.ts` (persistent-storage request once per session, storage estimate; never throw) and `BoardsQuery` runes class (reactive list with stale-response protection).

**Deviations:**
- **Test environment:** jsdom's `Blob`/`File` don't survive Node's `structuredClone` (used by fake-indexeddb) — they came back as empty objects. `vitest.setup.ts` now swaps in Node's `Blob`/`File` from `node:buffer`. Browsers are unaffected.
- Added `boardsRepo.expiredTrash()` (pure query) alongside `purgeExpiredTrash()`; step 05's `boardLifecycle.purgeExpiredTrash` should use `expiredTrash()` + `destroyBoard()`.
- `boardsRepo.create()` also accepts `createdAt` (needed by step 27 import to keep the original creation date).
- Added `src/lib/storage/index.ts` (namespaced re-exports) and `src/lib/storage/testUtils.ts` (`freshDB()` for tests).

**Dependencies added:** idb 8.0.3 (per plan).

**Follow-ups:** none.

**Verification:** pnpm verify ✅ (108 unit tests; storage suite stable across 3 repeated runs) · boardsRepo/assetsRepo 100% covered; storage overall 97% lines (uncovered: cross-tab `blocking` handler, one persist fallback) · no Svelte imports in src/lib/storage · e2e n.a. (no UI change)

## Step 05 — Board document lifecycle — 2026-09-28
**Summary:**
- `openBoard(id)`: Y.Doc + y-indexeddb, migrate, title backfill, tab sync, canvas `UndoManager` (elements map only, `LOCAL` only, 500 ms capture), debounced (2 s) `touchUpdated` on local edits; idempotent `close()` flushes the pending touch and tears everything down.
- `tabSync`: BroadcastChannel sync with a two-way hello handshake (a late joiner receives peers' state *and* sends its own offline edits); remote updates applied with `REMOTE_TAB`, never echoed.
- `loadSnapshot` / `writeSnapshot` / `deleteBoardData` / `duplicateBoard` (content, remapped image assets, thumbnail, independent copy).
- `boardLifecycle.destroyBoard` (content + meta + assets) and `purgeExpiredTrash` — the only deletion entry points for UI code.
- `shared/debounce.ts`: `debounce` (flush/cancel/pending) and leading+trailing `throttle`.

**Deviations:**
- Removed `boardsRepo.purgeExpiredTrash` (added in step 04): it deleted metadata but orphaned board content. Only `boardLifecycle.purgeExpiredTrash` remains; `boardsRepo.expiredTrash()` is the query it uses.
- Verified against y-indexeddb 9 source: persistence stores the doc's pre-existing state on first sync (so `writeSnapshot` applies the update before attaching), loaded updates carry the persistence as origin (don't trigger `touchUpdated`), and lib0 closes connections on `versionchange` (so `deleteBoardData` can't hang on another open tab).
- `src/lib/storage/index.ts` re-exports the lifecycle API.

**Dependencies added:** y-indexeddb 9.0.12 (per plan).

**Follow-ups:** none.

**Verification:** pnpm verify ✅ (130 unit tests; storage suites stable across 3 runs) — covers persistence across reopen, not-found and newer-schema errors, local-only touchUpdated, local-only undo, meta excluded from undo, snapshots, duplicate independence + asset remap, full destroy (IndexedDB database removed), purge, two open copies syncing · e2e n.a. (no UI change)

## Step 06 — Start page layout — 2026-09-28
**Summary:**
- Figma-like start page: header (logo, search placeholder, disabled Import/Settings, theme toggle), sidebar views (Recent/Starred/All/Trash via `?view=`, `aria-current`), "New board" card (double-click guarded → create → open), templates row (empty until step 28), responsive board grid with skeletons, empty states per view.
- `BoardCard`: link to the board, thumbnail blob → object URL (revoked on change/destroy) or deterministic pastel gradient (`placeholderGradient`, FNV-1a), "Edited …" via `relativeTime` (Intl.RelativeTimeFormat) with a 30 s ticking `now`.
- Requests persistent storage on mount. Board route placeholder shows the board title.

**Deviations:**
- Empty states for Recent/All have **no** extra "New board" button: the New board card is always directly above, and a duplicate button would be confusing (and ambiguous for tests/screen readers).
- `svelte/no-navigation-without-resolve` accepts `resolve('/?view=…')` (SvelteKit's `resolve` supports search strings), so view links are plain `<a href>` — no `goto` needed; back/forward work natively.
- `TemplateCardData` type lives in `home/views.ts` (exporting types from a component instance script isn't allowed).
- Added `shared/ui/Logo.svelte`; `tests/e2e/helpers.ts` has `resetStorage` and `createBoard`. Playwright gives each test a fresh context, so storage is already clean per test.
- Theme e2e test updated to use the empty-state text (the old placeholder "Your boards" text is gone).

**Dependencies added:** none.

**Follow-ups:** On 375 px the view tabs scroll horizontally (Trash is partly off-screen until scrolled) — acceptable; revisit in step 31 (a11y/touch pass).

**Verification:** pnpm verify ✅ (145 unit tests) · pnpm test:e2e ✅ (11 tests: empty state, create→open→listed with "Edited just now", view switching + back button, cross-tab live update, plus earlier suites) · **Manual/visual:** screenshots checked at 1440/768/375 px in light and dark — layout matches the design; dark placeholder gradients raised from 60% to 75% opacity after review (looked muddy).

## Step 07 — Board management actions — 2026-09-28
**Summary:**
- Card actions: star toggle (always visible when starred), "⋯" menu (Open, Open in new tab, Rename, Duplicate, Export [disabled], Move to trash; in trash: Restore, Delete forever), inline rename, duplicate toast, trash toast with Undo, delete-forever and "Empty trash" confirm dialogs (`shared/ui/ConfirmDialog`), trashed cards don't open (toast).
- Toolbar: search (header, 150 ms debounce, clear button, Escape clears, `/` focuses), sort Select (hidden in Recent; persisted), grid/list toggle (persisted). "No boards match …" empty state.
- Keyboard: roving tabindex (grid = one tab stop), arrows/Home/End, Enter opens, F2 renames, Delete trashes (in Trash: asks to delete forever). Purges expired trash on mount. CI gains an `e2e` job.
- `home/actions.ts` wraps storage calls with toasts; `home/homeUI.svelte.ts` context holds rename/delete-confirm state.

**Deviations:**
- **Card structure:** one stretched `<a>` (or `<button>` in trash) covers the card; star/menu/rename input sit above it. Consequently **double-click on the title does not rename** (a link's first click would navigate) — rename is via the menu or F2.
- **List layout reuses `BoardCard`** with `layout="list"` instead of a separate `BoardListRow.svelte` (one component, no duplicated actions logic).
- Uses Svelte 5 `{@attach}` for input autofocus and function bindings (`bind:editing={get, set}`).

**Bugs found by e2e and fixed:**
- Rename from the menu cancelled itself: the dropdown returned focus to its trigger on close, blurring the new input. Fixed with `onCloseAutoFocus` → `preventDefault()` when renaming.
- `ConfirmDialog` closed (resetting bound state) *before* calling `onConfirm`, so "Delete forever" deleted nothing. Now confirms first, then closes.

**Dependencies added:** svelte-sonner 1.2.1 (toasts; the plan named it).

**Follow-ups:** none.

**Verification:** pnpm verify ✅ (150 unit tests) · pnpm test:e2e ✅ (17 tests; home suite repeated 3× → 30/30) — full lifecycle, trash-not-openable, empty trash, search/sort/layout persistence, keyboard nav/F2/Delete, `/` focus, cross-tab updates · visual check of grid (star + open menu) and list layouts.

## Step 08 — Board page and top bar — 2026-09-28
**Summary:**
- `BoardPage`: loading (spinner only after 150 ms), not found, trashed (Restore → opens), error (incl. newer-schema message) states; opens via `openBoard`, `touchOpened`, closes on destroy (also if destroyed mid-open). Route keys `BoardPage` by id.
- `BoardWorkspace` sets the board context (`context.ts`: `setBoard`/`getBoard`); `TopBar` with home link, click-to-rename title, `SaveIndicator` ("Saving…" → "Saved locally" 600 ms after the last local update, tooltip about local storage), disabled Export menu, theme toggle.
- `BoardTitle` (`title.svelte.ts`): `meta.title` is the source of truth; local renames write doc + board list; renames from other tabs are mirrored to the board list; `document.title` follows.

**Deviations:**
- The route no longer sets a static `<svelte:head>` title (it fought the live `document.title`).
- Title is a button ("Rename board: …") that swaps to `InlineEditable` — keeps the accessible name stable for tests/screen readers.
- Updated earlier e2e expectations that targeted the step 06 placeholder page (`/board/abc` now shows "Board not found").

**Dependencies added:** none.

**Follow-ups:** none.

**Verification:** pnpm verify ✅ (154 unit tests, incl. `BoardTitle` local/remote/destroy) · pnpm test:e2e ✅ (21 tests: rename persists + reflects on home + `document.title`, cross-tab rename < 1 s, Escape cancels, not found, trashed → restore) · **leak check:** temporary log in `close()`, home→board→home ×3 = 3 opens / 3 closes (log removed) · **M1 reached.**

## Step 09 — Viewport: pan and zoom — 2026-09-28
**Summary:**
- Pure math `board/engine/viewport.ts` (screen↔world, clamp, zoomAt, panBy, visibleWorldRect, fitRect, nextZoomStep, centeredOrigin) + `engine/geometry.ts` rect helpers; `ViewportState` runes class (set/zoomAt/zoomBy/panBy/fit/reset100/animateTo with ease-out, geometric zoom and a straight path of the centered world point; instant under prefers-reduced-motion). Added to the board context.
- `Canvas.svelte`: world layer (single CSS transform) + screen-space overlay snippet, dot grid scaled with zoom (coarser below 8 px, `grid` pref), ResizeObserver size, viewport restored per board (or origin centered) and saved debounced 500 ms.
- `viewportInput` attachment: wheel pans, ctrl/⌘+wheel & trackpad pinch zoom at cursor (delta clamped so mouse notches ≈30 %, pinch stays smooth), Shift+wheel horizontal, Space+drag and middle-drag pan (capture phase, stops propagation so tools won't see it), two-finger touch pinch/pan. Shortcuts Shift+1/Shift+0/Mod+=/Mod+-/Mod+0 (browser zoom prevented). `ZoomControls` pill (−, % menu, +).

**Deviations:**
- Temporary origin marker kept (`data-testid="origin"`) — removed in step 10 as planned.
- `role="application"` canvas with `tabindex=0` needs a `svelte-ignore a11y_no_noninteractive_tabindex` (Svelte classifies the role as non-interactive; it must receive keys).

**Dependencies added:** none.

**Follow-ups:** **Needs a human:** trackpad pinch / two-finger pan feel in Chrome and Firefox (acceptance item left unchecked — no physical trackpad available to the agent; ctrl+wheel path is covered by e2e).

**Verification:** pnpm verify ✅ (169 unit tests; viewport math incl. zoom-anchor invariance) · pnpm test:e2e ✅ (24; new: ctrl+wheel zoom + restore after reload + page never scrolls/zooms, wheel pan, zoom buttons, Mod+= / Shift+0, Space+drag pans by exact delta)

## Step 10 — Element registry, board store, rendering — 2026-09-28
**Summary:**
- `BoardStore` (Yjs → Svelte bridge): immutable snapshots in a `SvelteMap` (per-key reactivity), `order`/`frameOrder` recomputed only on add/remove/z change, incremental `SpatialIndex` (rbush; bulk load, search/near/bounds), `version` signal, `contentBounds()`. Added to the board context.
- Element registry + definitions: real views for shape (rect/ellipse/diamond paths with stroke inset, radius, dash, fill style, text), sticky, text; placeholders for image/stroke/frame/doccard/connector. Shared style helpers (`common.ts`). Geometry: rotate, rotated AABB, rotated hit test, segment distance, point-in-polygon.
- `ElementView` (one absolutely positioned, `pointer-events:none` wrapper per element) and `ElementsLayer` with viewport culling (visible rect +50 %, recomputed ≤ once per frame, frames first). Shift+1 fits content. Origin marker removed.
- Test hooks (`window.__smthng` in dev or when `smthng:testHooks` is true — e2e) incl. `perf(n)`; deterministic `generatePerfElements`; dev-only `?debug=perf` button.

**Deviations / findings:**
- **Removed `will-change: transform` from the world layer** (step 09 had it). Measured in headless Chromium: panning with all 3,000 elements visible took **1,038 ms/frame with it vs 75 ms/frame without**; a plain-HTML control page showed the same pathology (597 ms/frame), so it's the browser's layer raster, not app code. No cost at 100% zoom (both ≈60 fps). Script/layout/style time during pans was ≈0.1 s total — rendering, not JS, dominates.
- Connector placeholder AABB uses its endpoints' positions (free or last known) until step 20.
- `BoardStore` reads changed keys via `event.changes.keys` (generic `YEvent`) rather than `keysChanged`.

**Dependencies added:** rbush 4.0.1, @types/rbush 4.0.0 (per plan).

**Performance (headless Chromium, software rendering, 1440×900, 3,000 mixed elements):**
| Scenario | DOM elements | Result |
|---|---|---|
| Pan at 100% zoom | 167 (culled) | **60 fps** (p95 16.7 ms) ✅ |
| Pan zoomed out to fit everything (10%) | 3,000 | **≈13 fps** (75 ms/frame) ❌ target 55 |

**Follow-ups:**
- The "≥ 55 fps with 3,000 elements" criterion is **left unchecked**: met at normal zoom, not when all 3,000 are visible at once in headless software rendering. Needs (a) a measurement in a real GPU browser by a human, and (b) likely a level-of-detail render at low zoom (hide text/shadows, simple boxes below ~30%) — scheduled for step 30 (performance pass), which already plans low-zoom previews.

**Verification:** pnpm verify ✅ (184 unit tests: geometry, spatial index, BoardStore create/update/delete/remote/identity/order/version/destroy) · pnpm test:e2e ✅ (27: render + persist, culling < 600 of 3,000 in DOM, Shift+1 fit, live cross-tab render, space-drag now measured on a real element)

## Step 11 — Tool framework and toolbar — 2026-09-28
**Summary:**
- Tool types (`CanvasPointerEvent`, `Tool`, `HandleId`), `ToolManager` (lazy tool instances, `register()` for later steps, `isAvailable`, `setTool` cancels the previous tool, `returnToSelect` honouring the lock, `shapeKind`), hand tool (drag pans) and minimal select tool (click selects, Shift toggles, empty clears).
- `pointerRouter` attachment: normalizes pointer/dblclick events (screen/world, mod, pressure), hit info = handle (screen-space `HandleRegistry`) else topmost element (`hitElement`, 6 px tolerance), pointer capture, hover → `selection.hoverId`, ignores `[data-interactive]` UI and events already consumed by panning.
- `hitTest.ts`: topmost-by-paint-order (frames beneath) with precise per-type tests; `hitElementsInRect` (intersect/contain).
- `SelectionState` (ids, editingId, hoverId, `prune` on store changes). Shortcut registry (`matchesKeys`: Mod = Cmd/Ctrl, letters by key or code, Shift+digit by code, punctuation ignores Shift; `isTypingTarget`). Tool + view shortcuts moved into the registry; one window keydown handler (tool first, then shortcuts; ignores typing targets and menus/dialogs). Escape: cancel → deselect → select tool.
- Toolbar: left vertical pill (bottom horizontal < 640 px), `role=toolbar`, `aria-pressed`, tooltips "Label — key", shapes flyout (rect/ellipse/diamond), lock toggle; tools not built yet are `aria-disabled` with "coming soon" tooltips (still hoverable, unlike `disabled`).

**Deviations:**
- `CanvasPointerEvent` gained `dragging: boolean` (hover moves are forwarded to tools with `dragging: false`); `BoardContext` gained `handles` and `shortcuts` (registries) besides `selection` and `tools`.
- `viewportInput` now uses `stopImmediatePropagation` (+ `preventDefault`) for pan gestures — `stopPropagation` doesn't stop other listeners on the same node, and the router checks `defaultPrevented` as well.
- `isTypingTarget` also matches `[contenteditable]` ancestors (robust for rich-text editor children; jsdom lacks `isContentEditable`).
- Canvas: default focus outline replaced by an inset accent ring on keyboard focus only (the black outline around the whole board looked broken).
- e2e: added `clickElement()` helper — element wrappers are `pointer-events:none` by design (D6), so Playwright's `locator.click()` refuses them; tests click by coordinates like a user.

**Dependencies added:** none.

**Follow-ups:** Toolbar arrow-key roving focus is scheduled for step 31 (a11y); Tab + Enter/Space work now.

**Verification:** pnpm verify ✅ (195 unit tests: shortcut matching mac/non-mac/Caps Lock/Alt/Shift+digit/punctuation/named keys, typing targets, hit testing incl. rotation/tolerance/frames-beneath, marquee modes) · pnpm test:e2e ✅ (33: key→tool + Escape, disabled tools ignore shortcuts, toolbar click + hand panning by exact delta, click/Shift-click/empty selection, no shortcuts while typing, keyboard-operable toolbar) · visual check of the toolbar.

## Step 12 — Creation tools and text editing — 2026-09-30
**Summary:**
- Shape tool (R/O/D): drag to draw (Shift = square/circle, Alt = from center, 3 px threshold), click = default 160×100 centered; sticky tool (S) and text tool (T): click to place and type immediately. After creating: new element selected, back to select (unless the toolbar lock is on).
- `TextEditor.svelte`: textarea overlay inside the element wrapper (so world transforms apply), same font/alignment/padding as the view; writes debounced 150 ms and flushed on exit; Escape / Mod+Enter / click-away exit; auto-width texts measure a hidden mirror and update w/h with the text.
- `TextEditing` controller (`board/editing.ts`, on the board context): start/end editing; a new text (text tool or double-click on empty canvas) left empty is removed by **undoing its creation and clearing redo**, so no phantom undo step remains (falls back to delete if other edits happened meanwhile).
- Select tool: double-click an editable element to edit it, double-click empty canvas to write a text there, Enter edits the single selected element. Selected/edited elements are always rendered (culling exempt).
- Helpers: `createRafWriter` (≤ 1 write per frame), `undoGesture` (one undo step per gesture regardless of pauses — raises `captureTimeout` for the gesture), `dragRect` (pure), `tools/create.ts` factories, `style/styleDefaults.ts`.

**Deviations:**
- Added `undoGesture` because `stopCapturing()` alone can't keep a slow drag (pauses > 500 ms) as one undo step; e2e covers a drag with a 700 ms pause. Step 13 (move/resize/rotate) should reuse it.
- `BoardContext` gained `editing: TextEditing` (in addition to `selection.editingId`, which stays the reactive source).
- The e2e "one undo step" checks use the test hooks' undo manager, since undo shortcuts arrive in step 14.
- Visual "no jump" check done by screenshotting each type (shape, sticky, text) in view vs edit mode at 2× DPR: identical.

**Dependencies added:** none.

**Follow-ups:** none.

**Verification:** pnpm verify ✅ (210 unit tests: raf batching, dragRect, undoGesture incl. 2 s pauses, TextEditing discard/keep rules) · pnpm test:e2e ✅ (40; new: drag rect size + single undo step despite pause, ellipse click/Shift circle, sticky type + reload, text auto-size + empty discard without undo step, double-click shape edit + Enter re-edit + Mod+Enter, double-click empty canvas, typing doesn't trigger tool shortcuts) · view/edit screenshots identical.

## Step 13 — Selection and transforms — 2026-09-30
**Summary:**
- Pure transform math `board/engine/transform.ts`: `selectionBox`, `resizeBox` (works in the box's rotated frame; opposite edge/corner fixed in world space; Shift aspect, Alt from center, min size, no flipping), `sizePatch` (strokes scale their points; auto-width text turns fixed when widened), `scaleElementsToBox`, `rotateElementsAround`, `normalizeAngle`, `snapAngle` (15°), `selectionHandles` / `hitHandle` (screen space), `cursorForHandle` (rotation-aware resize cursors).
- Select tool state machine (`tools/select.svelte.ts`): pointing → moving (3 px threshold; Shift axis lock; Alt duplicates first, keeping z order), marquee (touching; Shift adds; frames only when fully enclosed; locked excluded; whole groups), resize (single = rotated box, multi = proportional), rotate (single absolute, multi around the shared center; Shift snaps). Each gesture uses `undoGesture` + rAF batching = one undo step; **Escape mid-gesture reverts it** (undo + clear redo, incl. Alt copies). Click on an already-selected element of a multi-selection selects just its group on release.
- Groups: clicking a member selects the group; double-click enters the group (`selection.enteredGroup`) to select members. Locked: selectable, never transformed, lock badge instead of handles.
- `SelectionOverlay` (screen space): hover outline, per-element outlines in multi-select, selection box, 8 resize handles + rotate knob (rotated with the box), marquee; registers the handle hit-test with the pointer router (select tool only).
- Shortcuts: arrows nudge 1 px (Shift 10 px), Mod+A select all (unlocked), Shift+2 zoom to selection.

**Deviations:**
- `SelectionState` gained `marquee`, `transforming`, `enteredGroup` (UI state shared by tool and overlay); `board/selectionInfo.ts` holds shared helpers (`transformTargets`, `targetsBox`, `handleOptions`, `groupOf`).
- Select tool file renamed to `select.svelte.ts` (reactive cursor state).
- Connectors are skipped by transforms (their geometry is derived; free-ended connectors move with the selection in step 20).

**Dependencies added:** none.

**Follow-ups:** Frame children moving with their frame is step 16; snapping/guides step 18.

**Verification:** pnpm verify ✅ (240 unit tests; transform suite 30 incl. all 8 handles at 0° and 30° keeping the opposite point fixed) · pnpm test:e2e ✅ (47; new select suite: marquee + group move as one undo step, SE resize + Shift aspect, rotate + Shift snap to 45°, Alt-drag copy + Escape revert without undo step, groups + enter group, locked not movable/no handles, nudge + Mod+A) · **drag 1 of 3,001 at 100%: 60 fps (p95 16.7 ms)** in headless Chromium · visual check of handles on a rotated sticky.

## Step 14 — Editing commands — 2026-09-30
**Summary:**
- Commands (`board/commands/edit.ts`, one undo step each): delete (skips locked), duplicate (+16/+16, new ids, z order kept, doc card contents copied), reorder front/back/forward/backward (`reorder.ts`, pure: forward/backward pass the nearest *overlapping* unselected element; frames reorder only among frames), toggle lock, group/ungroup. Shortcuts: Mod+Z, Mod+Shift+Z / Mod+Y, Delete/Backspace, Mod+D, `]` `[` Mod+] Mod+[, Mod+Shift+L, Mod+G, Mod+Shift+G.
- `HistoryState` (reactive canUndo/canRedo) + Undo/Redo buttons in the top bar.
- Clipboard (`commands/clipboard.ts`): payload `SMTHNG-CLIPBOARD:{smthng, sourceBoardId, elements, docs(base64 Yjs update of doc card contents)}`; paste validates every element, remaps ids/groups, copies image assets across boards, restores doc card contents; same-board pastes cascade +16 px per repeat, other pastes center on the pointer (or view center). Plain text pastes as a text element. Image files go to an `imagePaste.handler` hook (installed in step 15).
- Canvas context menu (bits-ui): right-click selects what's under the cursor first; element actions (cut/copy/paste/duplicate/delete, order, group/ungroup, lock) or canvas actions (paste, select all, zoom to fit), with platform-formatted shortcut hints (`tools/formatKeys.ts`). `ctx.pointer` tracks the last world pointer position.
- `shared/base64.ts` (chunked, 1 MB safe).

**Deviations:**
- **Copy/cut/paste use the native `copy`/`cut`/`paste` document events** (not keyboard shortcuts): synchronous clipboard access with no permission prompt, and pasted image files arrive with the event. The context menu uses the async Clipboard API and falls back to the last in-tab copy if permission is denied.
- `BoardContext` gained `history` and `pointer`; `createWithContent()` helper creates elements + doc card contents in one transaction.
- Added `src/lib/board/testCtx.ts` (lightweight context for unit tests).

**Dependencies added:** none.

**Follow-ups:** The canvas undo scope is the `elements` map only, so undoing a duplicate/paste leaves the copied doc card's fragment orphaned in `docs` (harmless, invisible). Step 23 revisits the undo scope for doc cards.

**Verification:** pnpm verify ✅ (268 unit tests: reorder incl. several items passing one neighbour, commands, clipboard round-trip incl. doc text / group remap / cascade / pointer centering / cross-board assets / plain text) · pnpm test:e2e ✅ (54; commands suite repeated 5× → 35/35: keyboard copy/paste/duplicate/delete/undo/redo + buttons, cut/paste, cross-board paste, plain text paste, group + lock, context menu reorder + copy/paste, `]`/`[`) · visual check of the context menu.

## Step 15 — Pen, eraser, images — 2026-10-01
**Summary:**
- Pen (P): points (incl. coalesced pointer samples and real pen pressure; mouse = 0.5 → simulated pressure) collected locally and previewed in the screen-space overlay; **one document write on release** (RDP-simplified at 0.5 screen px, points stored relative to the bbox). Pen stays active.
- Stroke element: `perfect-freehand` outline → SVG path (memoized on points/width), dot for a click; hit test = distance to the centre line incl. brush radius and rotation; AABB includes the brush thickness.
- Eraser (E): samples the swipe every 4 px so fast moves don't skip elements, marks hits (30 % opacity), fading trail, deletes on release (one undo step), Escape cancels; locked elements are skipped.
- Images: upload (toolbar Image button / Mod+Shift+I → file picker), drag-and-drop at the drop point (dashed drop highlight), paste (the step 14 `imagePaste` hook). PNG/JPEG/GIF/WebP/SVG ≤ 20 MB; raster images > 2048 px downscaled to WebP; sized to fit half the view; several files cascade; one undo step; stored as blobs in IndexedDB; `AssetUrlCache` object URLs revoked on board close; `ImageView` with loading/missing states and optional border; `keepAspect` resize.
- `gcAssets` on board open deletes unreferenced assets of the board — only if older than 60 s, so an image another tab is just adding is never removed.

**Deviations:**
- "Image" is a toolbar **action** (opens the picker) rather than a tool; `tool.image` shortcut runs the action.
- `BoardContext` gained `preview` (`PreviewState`: in-progress stroke, eraser marks/trail) and `assets` (`AssetUrlCache`).
- 60 s grace period in `gcAssets` (not in the plan) to avoid a cross-tab race.
- Updated the step 11 e2e that used Pen as its example of an unbuilt tool (now Connector) — same rule tested.

**Dependencies added:** perfect-freehand 1.2.3 (per plan).

**Follow-ups:** **Needs a human:** pressure with a real pen/stylus (optional criterion, unchecked).

**Verification:** pnpm verify ✅ (282 unit tests: RDP, stroke hit/AABB/path, image sizing/validation, gcAssets grace + scoping) · pnpm test:e2e ✅ (59; new: stroke preview → written only on release → persists → eraser deletes, Escape cancels erasing, upload 64×48 PNG + reload, drop at point, image paste) · pen drawing with 3,000 elements: 60 fps (p95 16.7 ms) · visual check of strokes and an image. Fixture `tests/e2e/fixtures/sample.png` generated with Node zlib (no new dependency).

## Step 16 — Frames — 2026-10-01
**Summary:**
- Frame element: semi-transparent fill, border, title label above the top-left (world-sized, scales with zoom); hit only on the border band or title (empty interior clicks reach the canvas → marquee); not rotatable; bounds include the title. Frames render beneath everything (frame layer).
- Frame tool (F): drag (Shift square, Alt from center) or click for 800×600; titled "Frame N"; adopts elements fully inside.
- Membership (`engine/frames.ts` pure `frameFor`/`containsRect` + `board/frameMembership.ts`): topmost frame fully containing an element's bounds; recomputed after create (all tools, images, paste, duplicate), move, resize and nudge — inside the same undo step; frame moves/resizes re-check everything overlapping the frame before and after.
- Moving a frame carries its unlocked children (drag, Alt-duplicate, nudge); duplicate/copy of a frame includes its contents; deleting a frame (Delete, eraser) deletes unlocked children and **releases locked children** (parentId cleared) — one undo step.
- Title editing: double-click the title (or Enter on a selected frame) → inline input (Enter/blur saves, Escape cancels). Zoom menu lists frames → animate to fit (max 200%).

**Deviations:**
- Locked children of a deleted frame are kept and released (the plan said "delete children"; deleting locked content silently felt wrong).
- Frames are hit on a border band of 2× the hit tolerance (≈ 12 screen px) — the hit-test API has no zoom, so the band is derived from the tolerance.
- Copying/duplicating a frame includes its children (not in the plan; a frame copied empty would be surprising).
- Updated 4 earlier unit expectations that assumed frames behaved like plain boxes (interior hits, bounds without title) — new rules tested explicitly (border/title hits, interior misses).

**Dependencies added:** none.

**Follow-ups:** none.

**Verification:** pnpm verify ✅ (291 unit tests: frameFor/containsRect, membership enter/leave/frame resize, children for move/copy, delete with locked child released + undo, frame hit band/title) · pnpm test:e2e ✅ (64; new frames suite: children move with the frame / not after leaving, delete + undo, marquee inside an empty frame, title rename, zoom-menu navigation) · **M2 walkthrough:** built a retro board (frame + stickies + pen circle + shapes with text + free text + image), screenshot reviewed — a usable whiteboard.

## Step 17 — Style popover — 2026-10-01
**Summary:**
- `style/options.ts`: typed `StyleOption`, `STYLE_OPTIONS` per element type (wired into every definition's `styleOptions`), `optionsFor` (intersection across the selected types), `commonValue` (value or `MIXED`).
- `style/applyStyle.ts`: one transaction for the whole selection, nested font merge, `kind` only for shapes and `color` only for stickies; discrete changes are separate undo steps, continuous ones (slider) merge.
- `StylePopover` (screen-space toolbar above the selection, flips below near the top, clamped; hidden while transforming, marquee-selecting, editing, or with non-select tools): Shape kind, Sticky color, Fill (+ fill style), Stroke (+ width, dash), Text (size, bold/italic, align, vertical align, color), More (corners, shadow, opacity slider). Panels are bits-ui popovers; mixed values show no checked option / a neutral swatch.
- Controls: `ColorSwatches` (12-color palette with names, checkerboard transparent, custom color input), `Segmented` (radiogroup, arrow keys, one tab stop), `ToggleButton`, `Slider`, `PanelButton`, shape icons from the real shape paths.

**Deviations:**
- Grouped controls by topic in fewer panels than the plan's list: fill style sits in the Fill panel, width + dash in the Stroke panel, vertical align + bold/italic in the Text panel; "More" holds corners, shadow, opacity.
- The popover hides during any text editing (not only doc cards) — clicking it would blur the editor and end editing.
- The opacity slider starts a new undo step on pointer-down/focus, so one adjustment session (drag or keyboard) is one undo step (keyboard arrows were separate steps at first; caught by e2e).

**Dependencies added:** none.

**Follow-ups:** none.

**Verification:** pnpm verify ✅ (297 unit tests: option intersection, commonValue/MIXED, font merge, kind/color scoping, one undo step for multi-element and continuous changes) · pnpm test:e2e ✅ (72; new style suite: fill persists after reload, intersection of options for shape+sticky with shared change applied to both, mixed fills show no checked swatch, shape kind keeps text, sticky color, opacity adjustment = one undo step, bold toggle, keyboard on segmented controls, popover never covers the selection and flips below near the top, hidden while dragging/editing) · visual check of the Fill and Text panels; element views audited to honor every option they declare.

## Step 18 — Style productivity, alignment, snapping — 2026-10-01
**Summary:**
- Quick styles: 8 presets (Neutral, Blue, Green, Yellow, Red, Violet, Dark, Outline) stored per board in `meta.stylePresets` (defaults when missing/invalid; live across tabs); "Quick styles" panel applies fill, fill style, stroke, dash and text color — only what the target supports; right-click a preset → "Update from selection".
- Copy/paste style (Mod+Alt+C / Mod+Alt+V, kept in localStorage across boards): each target takes only the fields its type controls (`pickStyle`); one undo step.
- Defaults: "Set as default for new {type}" / "Reset default" in More (when the selection is one type); `getDefaultStyle` merges the saved default (validated; corrupted values ignored).
- Arrange panel (2+ unlocked elements): align left/center/right/top/middle/bottom, distribute horizontally/vertically (3+), same width/height; AABB-based; frames carry their contents; one undo step.
- Snapping (`engine/snapping.ts` pure + `tools/snapper.ts`): smart guides to nearby elements' edges and centers (6 screen px; candidates collected once per gesture, ≤ 300 nearest) for move, resize of unrotated boxes, and shape/frame drawing; grid snapping (24 px) per axis when no guide matched; red guide lines with end marks. View menu: "Show grid" and "Snap to grid" (also Mod+'), persisted (`BoardPrefs`).

**Deviations:**
- **Ctrl/Cmd disables snapping (not Alt):** Alt already means duplicate (drag) and from-center (draw/resize); using it for snapping would make those gestures unsnappable.
- Quick styles live in their own popover panel rather than a row in the bar (keeps the bar compact).
- Resize snapping only for unrotated boxes (guides are axis-aligned).
- `BoardContext` gained `prefs` (`BoardPrefs`); `PreviewState` gained `guides`.

**Dependencies added:** none.

**Follow-ups:** none.

**Verification:** pnpm verify ✅ (315 unit tests: align/distribute/match, snapMove/snapPoint/grid, presets persistence + patch scoping, pickStyle, defaults incl. corrupted data, copy/paste style one undo step, arrange with frame contents + undo, match size) · pnpm test:e2e ✅ (77; new arrange suite: align left, snap to an edge with guide shown and removed, Ctrl/Cmd disables snapping, snap to grid via Mod+', quick style + copy/paste style + set-as-default used by a new shape) · visual check of guides mid-drag and the Arrange panel · **M3 reached.**

## Step 19 — Connectable interface — 2026-10-01
**Summary:**
- `board/diagram/connectable.ts`: `Connectable` (outline, ports, portNormal, rayExit, localToWorld, worldToLocal — world coordinates, rotation-aware), `polygonConnectable(localOutline)` (ports where the box axes cross the outline; ray exit = farthest crossing), `boxConnectable` (rotated bounding box). `diagram/index.ts`: `getConnectable`, `isConnectable`, `nearestPort`.
- Every definition has `connectable`: shapes use `shapeOutline(kind)` (rect, 48-segment ellipse, diamond/decision; other flowchart kinds are rects until step 22); sticky, text, image, stroke, frame, doc card use the box; connectors are `null`. `ElementDefinition.connectable` is now typed `Connectable<E> | null`.
- Geometry: `raySegmentIntersection`, `rayPolygonExit`, `nearestPointOnPolygon`.

**Deviations:**
- `elements/fixtures.ts` provides `sampleElements(type)` (one per shape kind) built on `model/testFixtures.ts`.

**Dependencies added:** none.

**Follow-ups:** Strokes attach to their bounding box (convex hull is a later improvement per plan).

**Verification:** pnpm verify ✅ (473 unit tests — the matrix iterates the registry: 17 element variants × 3 rotations × {ports on outline with outward unit normals, ray exits on the outline toward the target, local↔world round-trip}, plus a guard that every type except connectors is connectable) · pnpm test:e2e ✅ (77, unchanged) · `connectable.ts` has no Svelte imports.

## Step 20 — Connector tool and endpoints — 2026-10-01
**Summary:**
- Pure diagram modules: `endpoints.ts` (`resolveEndpoints` for free/port/float/fixed ends with outward directions; floating ends aim at the other end or its element's center; missing elements fall back to last position; `makeEndpoint`), `geometry.ts` (`connectorGeometry` straight polyline + bounds, `distToPolyline`), `connectorIndex.ts` (element → attached connectors). They take a `DiagramWorld` (lookup + connectable) so they don't import the element registry; `diagram/world.ts` builds it.
- `BoardStore`: connector bounds derived from attached elements; when an element changes, only its connectors' index entries are refreshed — **moving a shape writes nothing to connectors** (D8, unit-tested).
- `diagram/ops.ts`: `createConnector`/`newConnector` (defaults: straight, end arrow), delete hook converts ends attached to deleted elements into free ends at their current position (same transaction → one undo restores both), clone hook remaps ends to copied elements or frees them (offset applied), `danglingConnectors`.
- Interaction: Connector tool (A) and dragging from a hovered element's **port dots** (select tool) share `connectGesture` (dashed preview, target outline + port dots, port within 12 px, float inside, Alt = fixed spot, no self-loops, < 8 px = cancel). A selected connector shows a highlight and two end handles: drag to re-attach / drop on empty canvas to detach (Escape reverts). Moving a selection carries selected connectors' free ends. Canvas menu: "Select dangling connectors". `ConnectorView` draws in world coordinates with a simple end arrow.

**Deviations:**
- `ElementDefinition.aabb`/`hitTest` take an optional `world` (connectors need other elements); other types ignore it.
- `cloneHooks` now also receive the offset (to shift free ends and fallback positions).
- `lastX/lastY` are written only when attaching (not on every move), per D8.
- **Bug found by e2e and fixed:** the pointer router reported only the handle when one was hit, which cleared the hover and hid the port dots under the pointer (flicker, impossible to grab). It now reports both the handle and the element under the pointer.
- Updated the step 11 e2e "unbuilt tool" example again (Connector → Doc card).

**Dependencies added:** none.

**Follow-ups:** Routing, markers and labels are step 21.

**Verification:** pnpm verify ✅ (481 unit tests: endpoint resolution incl. rotation/missing elements, makeEndpoint port/float/fixed, delete→free end + undo, clone remap, no connector writes when a shape moves, bounds follow) · pnpm test:e2e ✅ (88; new connect suite: all 7 connectable types connect to a rectangle and the connector follows its move; delete frees + undo reattaches; port-dot drag; end-handle re-attach and detach; no self-loop; free-to-free connector).

## Step 21 — Routing, markers, labels — 2026-10-01
**Summary:**
- `diagram/routing/` (pure): `route(kind, input)` — straight (through waypoints), curve (cubic Bézier along the port directions, k = clamp(0.4·dist, 40, 200); Catmull-Rom through waypoints), elbow (20 px stubs along the port axes; best of HV / VH / HVH / VHV by length + penalties for crossing the attached boxes, turning back into an element, and bends; waypoints routed orthogonally with alternating axes). `pointAt`, `nearestT`, polyline simplification.
- Markers (`diagram/markers.ts`): none, arrow, open arrow, triangle (hollow), diamond (hollow), circle, bar — scaled with stroke width.
- `connectorGeometry` now routes (with the attached elements' boxes), computes end angles and the label box, and is cached per connector snapshot + attached element snapshots (view, hit test and bounds share it). Hit test includes the label.
- `ConnectorView`: routed path, markers at both ends, label at `t` (optional background); double-click or Enter edits the label; dragging the label of a selected connector slides it along the path (one undo step).
- Style popover "Connector" panel: routing, start/end marker pickers with previews, label background. Defaults: new connectors are **elbow** with an end arrow; "Set as default for new connectors" also saves routing and markers.

**Deviations:**
- Markers are drawn as transformed paths at the ends instead of SVG `<marker>` elements (same look; reusable by the static SVG export in step 26, no per-connector `<defs>` ids).
- Elbow corners are sharp (optional rounding skipped).
- Label drag is available on the selected connector (its label is a handle), which avoids ambiguity with clicking the line.
- The planned visual-regression screenshot test (`toHaveScreenshot`) is deferred to step 32's visual suite (baselines are created there); a manual screenshot of a fixture with all routings and marker kinds was reviewed instead.
- **Mistake caught and fixed:** I briefly overwrote the existing `tests/e2e/routing.spec.ts` (URL routing tests) — restored from git; connector tests live in `connector-routing.spec.ts`.

**Dependencies added:** none.

**Follow-ups:** Small vertical offsets between facing ports produce a short jog in elbow routes (inherent to orthogonal routing; same in draw.io).

**Verification:** pnpm verify ✅ (491 unit tests: all routings start/end correctly, elbows orthogonal and outside both boxes, leave along the port, pass through bends, curve ≥ straight, pointAt/nearestT inverse, every marker has a shape) · pnpm test:e2e ✅ (92; new: default elbow + routing switch changes the path, markers at both ends, label edit + drag along the path, connector "set as default") · fixture screenshot reviewed.

## Step 22 — Bends, shape library, quick-create — 2026-10-01
**Summary:**
- Shape library: `shapePath` for all 11 kinds (rect, ellipse, diamond + process, decision, start/end, data, document, database, cloud, actor), with matching `shapeOutline`s for connector attachment. The toolbar's shape button is a flyout grouped Basic / Flowchart with drawn icons; items can be clicked (pick the tool) or dragged onto the canvas (created at the drop point, joins a frame under it). The style popover's shape picker lists every kind.
- Quick-create: four "+" buttons outside the ports of the hovered or single selected element. Click → a same-type, same-style neighbour 80 px away (shifted sideways while the spot is taken), connected port to opposite port, in one transaction / undo step; the new element is selected and starts text editing. Shift+click opens a type picker (all shapes, sticky, text, doc card). Keyboard: Mod+Alt+Arrows. Mod+Shift+A (and the canvas menu) selects everything connected to the selection.
- Bends: a selected elbow connector shows a handle on each inner segment — dragging slides the segment and stores the route as waypoints; straight/curve connectors show midpoint handles (drag inserts a waypoint) and round waypoint handles (drag to move, double-click to remove). "Reset route" in the connector panel and the canvas menu clears waypoints.

**Deviations:**
- Quick-create maps types it can't clone meaningfully: image → sticky, stroke → rectangle, text stays text; frames create a same-size frame.
- Buttons linger 700 ms after the pointer leaves the element so they can be reached across the gap. On a selected element the top "+" is omitted: the rotate handle and the style popover sit there (Mod+Alt+Up still works). Found by the full e2e run — the top "+" covered the rotate handle.
- Cloud connects on an inscribed ellipse; document on its average bottom line (close enough to the drawn outline).
- `selectConnected` lives in `quickCreate.ts` (`connectedComponent`) and is tested in `quickCreate.test.ts` rather than a separate file.
- The e2e mixed diagram uses sticky → doc card → sticky → shape via quick-create (quick-create can't produce images, and e2e has no image fixture helper); images connecting is covered by the connectable matrix test and the step 20 connect suite.
- Not done (manual): timing a 20-node diagram build.

**Dependencies added:** none.

**Follow-ups:** `commands.spec` "context menu reorders layers" failed once in a full e2e run and passed in 4 reruns (flaky; watch it).

**Verification:** pnpm verify ✅ (499 unit tests; new: placement per direction + collision shift, same-kind/override/type mapping, one undo step, connected component BFS, elbow bends reproduce the dragged polyline) · pnpm test:e2e ✅ (97; new `diagram.spec.ts`: 3× quick-create chain → 4 shapes + 3 connectors, Mod+Shift+A selects 7, Shift+click type picker, elbow segment drag → waypoints → Reset route, mixed diagram all attached, drag-drop from the library) · screenshots of all 11 shapes, the flyout and the "+" buttons reviewed.

## Step 23 — Doc card element — 2026-10-01
**Summary:**
- TipTap v3 installed: `@tiptap/core`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-list` (TaskList/TaskItem), `@tiptap/extensions` (Placeholder), `@tiptap/extension-collaboration` — all 3.31.4 — plus `@tiptap/y-tiptap` 3.0.9 (the v3 Yjs binding, peer of collaboration) and `y-protocols` 1.0.7 (its peer).
- `doccards/editorFactory.ts` is the only TipTap importer: StarterKit (headings 1–3, `undoRedo: false`, underline off, link with `openOnClick: false`, autolink, http(s)/mailto only), nested task lists, placeholder, Collaboration bound to the card's `Y.XmlFragment`.
- `DocCardView`: card (fill/border/radius from style, shadow from the wrapper), 40 px header (collapse chevron, title), body with a live read-only editor that becomes editable while editing. `prose.css` (em-based, scales with the font size; colors from `currentColor` and `--accent`, so it works on any card fill and in both themes).
- Editing: double-click on the body (caret placed at the click via `posAtCoords`) or Enter → body; double-click on the header or any edit of a collapsed card → title input. Escape leaves editing and keeps the card selected; a pointerdown outside the body also leaves it. Wheel inside the body scrolls it when it can, otherwise the canvas pans; Mod+wheel always zooms the canvas.
- Collapse/expand (header chevron) is one undo step; `h` = 40 while collapsed and `expandedH` restores it; connectors follow automatically.
- Resize limits: elements may declare `sizeLimits(el)` (new optional definition field; `resizeBox` gained per-axis `limits`). Doc cards: min 240×120; collapsed cards keep a fixed 40 px height.
- Doc card tool (N): click → a 360×280 card centered on the pointer, editing the body.

**Deviations:**
- **Undo scope (D10 updated, as the step prescribes):** verified that with an `elements`-only scope, undoing a card deletion restored the element but not its `docs` fragment (empty card). The canvas UndoManager now covers `elements` + `docs` (still `LOCAL` only; editor transactions use the y-prosemirror origin and stay out). `createBoardUndo(doc)` in `storage/boardDoc.ts` is shared by the app and `testCtx`. This also fixes the step 14 follow-up: undoing a duplicate or paste no longer orphans a fragment.
- `SelectionState.editingAt` (client point of the double-click) and `editing.start(id, { at })` were added so the view can tell header from body and place the caret.
- Doc cards are not rotatable (a rotated editor breaks caret placement and is hard to use).
- Task checkboxes toggle only in edit mode (simplest; read-only bodies have `pointer-events: none` like every element).
- The definition stays in `elements/index.ts` with the other types (no separate `definition.ts`); the placeholder view was deleted (no placeholders left).
- The "Open" (focus mode) header button is added in step 24 together with focus mode rather than hidden now.
- `tools.spec` "unbuilt tools are disabled" no longer has a subject (every tool exists): it now asserts that no toolbar button is disabled and that N picks the doc card tool.

**Dependencies added:** the TipTap packages above, `@tiptap/y-tiptap`, `y-protocols`.

**Follow-ups:** The board route's JS is ~188 KB gzipped including TipTap; lazy-loading `editorFactory` is step 30.

**Verification:** pnpm verify ✅ (507 unit tests; new: editor writes headings/lists into the fragment, a synced second doc renders the same text, task lists + heading limit, safe links only, undo of deletion restores text while typing stays out of canvas undo, undo of creation removes the fragment, collapse/expand undo steps, per-axis resize limits) · pnpm test:e2e ✅ (101; new `doccard.spec.ts`: N + markdown shortcuts → H1 + list persist after reload and appear in a second tab within 1 s; mouse text selection doesn't move the card; collapse → 40 px with the connector still ending at the card, expand restores; copy/paste copies the text; deleting and undoing restores it) · screenshots of an edited card and a collapsed card reviewed.

## Step 24 — Focus mode, formatting menus, mentions — 2026-10-01
**Summary:**
- Focus mode (`doccards/FocusMode.svelte`): a full-window dialog with "← Board", the title (click to rename) and close; a 760 px column at 17 px. It has its own editable editor on the same fragment; the canvas card stops editing while it's open. Opened by Mod+Enter (a selected card, or inside a card editor), the header's "Open" button, or a double-click on the header outside the title (a double-click on the title still renames it). The URL drives it (`?doc=<id>`, `doccards/focus.ts`): opening pushes an entry marked with `page.state.focusPushed`; closing goes back if we pushed it, otherwise it replaces the URL (deep links). So back closes, forward reopens, and deep links open after load. An unknown id shows the toast "Doc card not found" and strips the parameter. Escape closes it, Tab is trapped, and focus returns to the canvas.
- Bubble menu (TipTap bubble-menu, both editors): Bold, Italic, Strike, Code, Link (an inline URL input: Enter applies, empty removes, http(s)/mailto only, a bare domain gets https://), H1–H3. It is positioned by floating-ui (`fixed`, flip + shift), so it stays on screen.
- Slash commands (`slash.ts`): 9 items with prefix-then-substring filtering over titles and keywords.
- Mentions (`mentions.ts`): `@` over frames and doc cards (titles) and shapes, stickies and texts (first 40 characters, one line), prefix matches first, max 8. The chip is `@label`. A decoration plugin strikes through chips of deleted objects, refreshed when elements change. Clicking a chip (editing card or focus mode) closes focus mode, animates the viewport to the object, selects it and pulses it (`PulseHighlight.svelte`). A deleted object shows the toast "This object was deleted". Labels are stored at insert time and are not live-updated.
- Both popups use one `SuggestionList` mounted with `mount()` into `document.body`. It sits below the caret, flips above near the bottom and is clamped horizontally. Keys: arrows, Enter/Tab, Escape.
- Shortcuts registered in group "Doc": Mod+Enter, plus Mod+B/I/Shift+X/E listed for reference only (`when: () => false`; the editor handles them).

**Deviations:**
- Double-click on the header: the title renames, the rest of the header opens focus mode (step 23 renamed on any header double-click).
- ProseMirror prevents the default of every Escape, so "Escape closes the popup only" can't use `defaultPrevented`. The suggestion renderer records the key events it consumes (`isSuggestionKey(e)`), and the card and focus mode check that.
- **Bug found visually and fixed:** the bubble menu appeared at the window's left edge. Its first position was computed before TipTap set `width: max-content`, so it measured as full width. The menu now has `w-max` from the start.
- Mention chips are clickable only in an editing card or in focus mode (read-only canvas cards don't take pointer events, like every element).
- `editorFactory` gained options (`bubbleMenu`, `bubbleMenuParent`, `extra` extensions). `boardEditor.ts` wires slash and mentions to the board. TipTap is imported only by `doccards/` modules.
- `App.PageState.focusPushed` added in `app.d.ts`; `PreviewState.pulse` added.

**Dependencies added:** `@tiptap/extension-bubble-menu`, `@tiptap/suggestion`, `@tiptap/extension-mention` (3.31.4), `@floating-ui/dom` 1.8.0 (peer of suggestion; also used by bubble-menu).

**Follow-ups:** The board route's JS is ~205 KB gzipped with TipTap. Lazy-loading the doccards modules is step 30.

**Verification:** pnpm verify ✅ (515 unit tests; new: slash filtering, mention ranking/limit/exclusions/labels) · pnpm test:e2e ✅ (106; new `focus-mentions.spec.ts`: Mod+Enter → `?doc=` → type → back closes and the card shows the text → forward reopens → Escape closes; a deep link opens focus mode and close replaces the URL; an unknown id → toast + stripped; `/head` + Enter → H1; bubble menu Heading/Bold keeps editing; `@Log` + Enter → chip → click selects and centers the sticky with a pulse; a deleted target → struck-through chip + toast; the slash popup near the bottom stays inside the window) · screenshots of the mention popup, slash popup, bubble menu (card and focus mode) and focus mode reviewed.

## Step 25 — Markdown export — 2026-10-01
**Summary:**
- `doccards/markdown.ts` (pure, works on the editor's JSON): `docToMarkdown(doc, { title })` handles every node in the doc card schema:
  - Blocks: paragraphs, headings 1–3, bullet, ordered and task lists (nested, tight), blockquotes (with nested blocks), fenced code (longer fence when needed), horizontal rules, hard breaks.
  - Inline: mentions (`@label`) and marks applied in a stable order (link ⟩ bold ⟩ italic ⟩ strike ⟩ code). Adjacent text nodes with the same marks are merged, and whitespace stays outside delimiters.
  - Escaping: inline `\ * _ ` [ ]` everywhere, plus `#`, `>`, list markers and `1.` at line starts.
- `docJson.ts` `getDocJSON` reads a live editor (new `editorRegistry.ts`; the canvas card and focus mode register theirs), or else a short-lived headless editor on the fragment.
- `exportMarkdown.ts`: copy to the clipboard (toast "Copied as Markdown") or download `slug(title) || 'doc'` + `.md`. Available from a "⋯" menu in the card header and in the focus-mode top bar, and from the canvas context menu when one doc card is selected.
- `shared/slug.ts`, `shared/download.ts`.

**Deviations:**
- Ordered-list continuation lines are indented by the marker width (3 for `1.`–`9.`, 4 for `10.`), as CommonMark requires; the plan said a fixed 3.
- Link URLs: spaces and parentheses are percent-encoded so the `[text](url)` form stays valid.
- Focus mode ignores Escape while a menu (the "⋯" menu) has focus.

**Dependencies added:** none.

**Follow-ups:** none.

**Verification:** pnpm verify ✅ (547 unit tests; new: a table of every node and mark, nested bullet → ordered → task, quote with a list, code containing a fence, escaping, mention, `start: 3`, title-only, adjacent-mark merging; slug; `getDocJSON` headless vs live) · pnpm test:e2e ✅ (108; new `markdown.spec.ts`: H2 + checklist + bold typed with Markdown shortcuts → "Download .md" file content and "Copy as Markdown" clipboard content match exactly) · manual spot check: a sample covering nesting, escaping, fences, marks and hard breaks rendered as intended with `marked` (GFM), run one-off and not added to the project.

## Step 26 — Static SVG renderer, export, thumbnails — 2026-10-01
**Summary:**
- `render/staticSvg.ts` (pure; measuring, image data and doc lines are injected) mirrors the DOM views without `foreignObject`:
  - shapes: `shapePath` plus wrapped, aligned text
  - stickies: shadow filter
  - texts: auto-width or wrapped
  - images: data URLs, rounded clip, border
  - strokes: `strokeSvgPath`
  - frames: semi fill via `fill-opacity`, title above
  - doc cards: header, separator, clipped body lines
  - connectors: the shared `connectorGeometry`, markers from `markerShape`, label with an optional background
  - All text is XML-escaped.
- `render/wrapText.ts` handles newlines, word wrap and hard breaks of long words. Text is measured with canvas `measureText`, falling back to an estimate in jsdom.
- `render/bounds.ts` and `elements/connectables.ts`: the renderer computes bounds and connector geometry without the Svelte registry (`pureWorld`). The registry now takes its shape connectable from the same module, and a test checks that the two agree for every type.
- `doccards/docLines.ts`: doc JSON → plain lines (headings, `•`, `1.`, `☐`/`☑`, mentions, hard breaks).
- `render/exportImage.ts`:
  - Scopes: board; selection (plus frame contents and connectors between included elements); frame (children plus connectors with both ends inside).
  - Exports SVG or PNG at 1–3×, capped at 16,384 px per side and ~120 Mpx (the scale is reduced, with a toast).
  - Asset data URLs are cached per export.
- `ui/ExportDialog.svelte`: format, area (board / selection / frame picker), background, scale, a live preview and Download (`slug(title)` plus a scope suffix). Opened from TopBar Export → "PNG…" / "SVG…" and from the context menu's "Export selection…".
- `render/thumbnails.ts`: the board fitted into 480×300 on `#f7f7f8` (WebP 0.8). Saved 10 s after the last local edit, when the tab is hidden, and when the board closes (only if something changed). Fire and forget.

**Deviations:**
- Doc card text is read synchronously at the start of a render (`getDocJSONSync`), so a thumbnail rendered while the board closes doesn't depend on the doc that's being destroyed.
- Marker "hollow" fills and label backgrounds use the chosen background, or white for transparent exports.
- Doc card headings render at one size (1.3×) in static output, smaller than the canvas H1; checkboxes are ☐/☑ glyphs.
- The planned "every type" snapshot is split: a structural test over all types (valid XML, one `<g>` per element, no `foreignObject`, no external refs) plus a small fixed snapshot.

**Dependencies added:** none.

**Follow-ups:** Manual export check in Firefox not done (only Chromium is installed here).

**Verification:** pnpm verify ✅ (561 unit tests; new: wrapText, renderer over every type, XML escaping, transparent background/padding, snapshot, export scopes, docLines, pure connectables vs registry) · pnpm test:e2e ✅ (112; new `export.spec.ts`: PNG download > 1 KB with a PNG signature, SVG download is escaped and has no foreignObject, "Export selection…" preset and filename, leaving the board shows a thumbnail `<img>` on the start page) · manual comparison of a canvas screenshot and a 1× PNG of a fixture (frame, terminator/decision/database shapes, sticky, elbow/straight/curve connectors with labels and circle/diamond/arrow/open-arrow markers, a doc card with heading and checklist): positions, colors, wrapping and markers match.

## Step 27 — `.smthng` files, import, backup — 2026-10-01
**Summary:**
- `storage/fileFormat.ts`: the zod schema matches §10 exactly (board and backup files, base64 validated). Exports a board (meta, Yjs snapshot, assets) or a backup of every non-trashed board; a backup stores the pref `lastBackupAt`.
- `parseSmthngFile` errors are user-friendly: not JSON, not a SMTHNG file, newer version, damaged (with the field path). Backups keep their valid boards and count the damaged ones.
- `importPayload` always creates a new board (keeping `createdAt`) and new asset ids:
  - The doc is applied to a temp doc (`IMPORT`) and migrated **before** anything is created.
  - Image `assetId`s are remapped; invalid elements are dropped and counted.
  - Missing doc card fragments are created and the title is set before `writeSnapshot`.
  - A failure after creating the board destroys it, so no half-imported board is left behind.
- `importFile`: rejects files over 500 MB, asks before importing over 100 MB, and imports boards sequentially, returning warnings.
- Start page:
  - Import button (header, multiple files) and a full-page drop overlay ("Drop .smthng files to import").
  - Card menu "Export" and sidebar "Backup all boards" (`smthng-backup-YYYY-MM-DD.smthng`).
  - Toasts: "Imported “X”" (with Open) or "Imported N boards", warnings, and "Couldn’t import {file}: {reason}".
- Board TopBar Export menu: "Download .smthng" and, where `showSaveFilePicker` exists, "Save to file…". The picked handle is kept for the session, so the item becomes "Save to {name}" and rewrites without prompting; a cancel (AbortError) is silent.

**Deviations:**
- The File System Access API types are declared locally in `saveToFile.svelte.ts` (not in TypeScript's DOM lib).
- The drop overlay listens on the window of the start page only (the board has its own image drop).

**Dependencies added:** none.

**Follow-ups:** Manual Chrome → Firefox import check not done (no Firefox installed here).

**Verification:** pnpm verify ✅ (566 unit tests; new: round trip of a board with every element type, an image asset and doc card text → new board with remapped asset of the same size, equal text and title, original untouched; a 3-board backup imports 3 boards; rejects non-JSON, a wrong format, a newer version and malformed base64; an invalid element is dropped with a warning) · pnpm test:e2e ✅ (115; new `files.spec.ts`: export "Launch" from the card menu → delete forever → import via the Import button → same title and the sticky "Exported" is there; importing twice gives two boards; a bad file shows the error toast; the board Export menu downloads `untitled-board.smthng`) · drop overlay screenshot reviewed.

## Step 28 — Templates — 2026-10-01
**Summary:**
- `templates/index.ts`: registry (Flowchart, Brainstorm, Meeting notes). Metadata is eager; builders load on use. `createBoardFromTemplate` builds into a migrated temp doc (all writes `TEMPLATE`), creates the board, writes the snapshot, then renders and saves a thumbnail so the card has a preview immediately.
- `templates/builder.ts` (`TemplateBuilder`) builds frames, shapes, stickies, texts, doc cards and connectors with explicit styles, `parentId`s and port positions (from the pure `connectableFor`), then writes them in one `TEMPLATE` transaction.
- `templates/docContent.ts`: `setDocContent` (`prosemirrorJSONToYXmlFragment` from `@tiptap/y-tiptap` with `getSchema(docExtensions(...))`) and `fragmentToJSON` (no editor needed).
- The templates:
  - **Flowchart:** frame; Start → Step 1 (Blue) → OK? (Yellow) → Yes → Step 2 (Blue) → End; an elbow "No" back to Step 1.
  - **Brainstorm:** frame; a violet "Topic" ellipse; six stickies in the six sticky colors at radius 320; curved, marker-less connectors; title text.
  - **Meeting notes:** a 480×560 doc card (H1, date, attendees, numbered agenda, notes, 3 action items) → elbow "decisions" → frame "Decisions" with 3 stickies.
- Start page: `TemplateCard`s next to "New board". Previews are built in memory and rendered to SVG data URLs once the row is on screen, cached per session, with a skeleton until ready. A click creates the board and opens it.
- `render/thumbnails.ts` gained `thumbnailFromSvg`; `templates/preview.ts` renders any `Y.Doc` without a board context (`renderDocSvg`, `thumbnailForDoc`).

**Deviations:**
- `Template.build` is async (it lazy-imports the builder module).
- Template connectors are built directly rather than with `newConnector`, which reads user defaults and pulls in the element registry. Templates look the same for everyone.
- The template cards' accessible names are "{name} template"; "New board from template: …" collided with the existing "New board" button in tests.
- Bundle check: the home route's static imports (node 2) contain no TipTap/ProseMirror (~149 KB gzipped). Template builders, previews and the doc-content helper are separate lazy chunks.

**Dependencies added:** none.

**Follow-ups:** none.

**Verification:** pnpm verify ✅ (572 unit tests; new, per template: every element passes `parseElement`, only `TEMPLATE` transactions, connector ends exist, frame children inside their frame; flowchart 5 shapes + 5 connectors with Yes/No; brainstorm six colors; meeting notes Markdown has the agenda and action items) · pnpm test:e2e ✅ (117; new `templates.spec.ts`: the Flowchart card shows a preview → opens a board with 5 shapes, 5 connectors and Yes/No labels → back home the board card has a thumbnail; Meeting notes opens with "Action items" and 3 checkboxes) · screenshots of the start-page row and the three boards (fit-to-content) reviewed: tidy.

## Step 29 — PWA, settings, backup reminder — 2026-10-01
**Summary:**
- Icons: `static/logo.svg` (indigo rounded square, white diamond, node and connector line). `pnpm icons` (`@vite-pwa/assets-generator`, `pwa-assets.config.ts`) generates `favicon.ico`, `pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png` and `apple-touch-icon-180x180.png` (the last two full-bleed indigo). `favicon.svg` is the logo. The Svelte placeholder favicon is gone; icon and manifest links are in `app.html`.
- PWA (`@vite-pwa/sveltekit`, `registerType: 'prompt'`): manifest with the name, colors, icons and the `.smthng` file handler. Workbox precaches every client file (38 entries, ~1.2 MB) and falls back to `/` for navigation, so every route reloads offline, including lazy chunks.
- `shared/pwa.svelte.ts`: registers the worker (lazy import of `virtual:pwa-register`) and captures `beforeinstallprompt` (`canInstall`, `install()`). On a waiting update it shows a persistent toast "A new version is available" with "Reload"; it never reloads on its own.
- File handling: `handleLaunchFiles()` on the start page imports files the installed app was opened with and opens the board when there is exactly one.
- `SettingsMenu` (start-page ⚙ and board TopBar): theme radio items, Install app (when available), Backup all boards, Restore from backup…, storage usage and persistence with "Request persistent storage", and About (version from `__APP_VERSION__`, the storage note, a placeholder repository link).
- `BackupReminder`: a banner when there are 3+ boards, no backup in the last 14 days and no dismissal in the last 7 days. "Back up now" / "Later". The rule is the pure `shouldShowBackupReminder`.

**Deviations:**
- `@vite-pwa/assets-generator` is 1.x (the peer range of `@vite-pwa/sveltekit` 1.1.0), so icon file names follow its `minimal2023` preset rather than the names in the step.
- The SPA fallback is precached as `/` (`spa.fallbackMapping`) with a per-build revision. The plugin's default (reading `_app/version.json`) failed at build time, and the preview server answers `/index.html` with 404, which made the worker's install fail.
- `kit.paths.relative: false`: with relative asset URLs the cached `/` page broke when served as the fallback for `/board/<id>` offline.
- `registerSW({ immediate: true })`: registration is lazy-imported after page load, so it must not wait for the load event.
- The launch-queue consumer is set on the start page only (the manifest's file handler action is `/`).
- `requestPersistentStorage(again)` can re-ask on an explicit user request.
- **Test corrected (not weakened):** `commands.spec` "context menu reorders layers" right-clicked "empty canvas" at (40, 400), which is on the toolbar. It passed only while the previous menu was still closing (the click fell through to the canvas) and failed under load, when the toolbar got the click. It now right-clicks real empty canvas (300, 620). Stress run: 150/150.

**Dependencies added:** `@vite-pwa/sveltekit` 1.1.0, `@vite-pwa/assets-generator` 1.0.4 (dev); `workbox-window` 7.4.1 (the registration module imports it).

**Follow-ups:** Manual checks not done: Chrome DevTools → Application → Manifest installability and the Lighthouse "Installable" audit.

**Verification:** pnpm verify ✅ (578 unit tests; new: backup reminder rule, byte formatting) · pnpm test:e2e ✅ (123; new `offline.spec.ts`: create a board → worker active → offline → the board reloads with its shape, the start page lists the board and renders the template previews; `settings.spec.ts`: storage line, theme switch, About with the version, settings on a board, the reminder with 3 boards and "Later" persisting across reload, the manifest with reachable icons and the file handler) · screenshot of the start page with the reminder and the settings menu reviewed.

## Step 30 — Performance pass — 2026-10-02
**Summary:**
- **Lazy loading:**
  - The rich-text editor (TipTap) is a separate chunk (`doccards/lazy.ts` → `boardEditor`), loaded by `DocCardView` and `FocusMode`. It is warmed up when the board is idle or the doc card tool is picked; a skeleton shows meanwhile.
  - The export dialog with the static renderer, the thumbnail renderer, `fileFormat`, template builders and template creation all load on first use.
  - The start page no longer loads Yjs or the data model: duplicate, delete, trash purge and template creation import them on demand.
- **No editor needed to read doc cards:** `doccards/fragmentJson.ts` reads a Yjs fragment straight into editor JSON (a test checks it gives the same Markdown as `editor.getJSON()`). Markdown export, static rendering, thumbnails and template previews use it. `editorRegistry` and the headless editor are gone; `getDocJSON` is synchronous.
- **Doc cards at low zoom:** below 40 % zoom a card shows its title and three skeleton lines instead of a live editor (an edited card always keeps its editor; culled cards are unmounted).
- **Culling:** `ElementsLayer` skips work while the view stays inside the rect its last search covered (same zoom and content), and keeps the visible set when the ids didn't change, so panning doesn't re-diff the mounted elements.
- **Strokes:** `strokePathMemo` reuses the outline when a moved stroke's points are unchanged.
- **Tooling:** `createMixedPerfBoard` (strokes, doc cards with text, frames, images sharing one asset, connectors in all routings; `__smthng.perfMixed`, dev button), `__smthng.renderCounts`, `performance.measure('board-open')` from route mount to the first painted elements, and `pnpm analyze` (`rollup-plugin-visualizer` → `stats.html`, gitignored).
- **Hot-path checklist, verified by reading the code:** all pointer-driven writes go through `createRafWriter` (move, resize, rotate, create, bends, label, endpoint drags); `BoardStore` recomputes order only on add/remove/z change and updates the spatial index incrementally; culling runs at most once per frame; `connectorGeometry` is cached by snapshot identity; snapping is capped at 300 candidates from the index.

**Results** (headless Chromium, software rendering, this machine; 3,000 mixed elements unless noted):

| Metric | Target | Result |
|---|---|---|
| Pan, 3k mixed, 100 % zoom (135 mounted) | ≥ 55 fps | 58 fps (p95 17 ms) ✅ |
| Pan, 3k mixed, 50 % zoom (450 mounted) | ≥ 55 fps | 52 fps (p95 17 ms) ⚠ |
| Pan, 3k mixed, all visible (10 % zoom, 3,001 mounted) | ≥ 55 fps | 33 fps (p95 67 ms) ❌ |
| Drag 1 of 3k | ≥ 55 fps | 60 fps ✅ |
| Open 1k mixed (cached) | < 1 s | ~370 ms to first paint (~450 ms since navigation) ✅ |
| Home JS gz (static imports) | < 150 KB | 109 KB ✅ (was 163 KB before this step) |
| Board JS gz (excl. TipTap) | < 300 KB | 218 KB ✅ (editor chunk: 137 KB, lazy) |

**Deviations:**
- **Pan with everything visible misses the target** (33 fps; 27 before the culling change). A CDP profile of 60 pan frames: script 281 ms, style 91 ms, layout 55 ms out of 3,723 ms of main-thread work. The rest is the browser painting ~52,000 DOM nodes; app code is under 5 ms per frame. Removing per-element shadows at low zoom made no measurable difference (tried, reverted), and promoting the world layer makes it much worse (step 10). A real GPU should do better than this software renderer, but that isn't measured. The remaining fix would be a canvas renderer for low zoom, which is out of scope without the human's approval.
- **Found by the new e2e test and fixed:** with the editor lazy-loaded, the first keystroke after placing a card could arrive before the editor had focus and hit a canvas shortcut. The editor is now warmed up early, and canvas shortcuts are ignored while anything is being edited (Escape still leaves editing).
- Open time is measured to the first painted elements (two frames after the first culling pass), on a mixed board rather than shapes only.
- The home-bundle check in e2e reads the content of the page's statically loaded scripts (chunk names are hashes, so name matching alone proves little).

**Dependencies added:** `rollup-plugin-visualizer` 7.1.1 (dev).

**Follow-ups:** Decide whether the all-visible pan case needs a canvas renderer at low zoom; re-measure the fps numbers on real hardware.

**Verification:** pnpm verify ✅ (581 unit tests; new: fragment → JSON equals editor JSON, stroke memo) · pnpm test:e2e ✅ (125; new `perf-guard.spec.ts`: on a 500-element mixed board, dragging one element changes no other element's render count; the start page's static scripts contain no TipTap/ProseMirror; a doc card shows the preview at 30 % zoom and its editor at 100 %).

## Step 31 — Accessibility, help, onboarding — 2026-10-03
**Summary:**
- **Axe audit** (`tests/e2e/a11y.spec.ts`, `@axe-core/playwright`): zero serious or critical violations on the empty start page, the start page with boards, the settings menu, a board with a selection and the style popover, focus mode, the export dialog, the shortcuts dialog, and the start page and a board in dark mode.
- **Toolbar:** one tab stop with arrow keys, Home and End (`ui/rovingTabindex.ts`). Labels include the key ("Rectangle (R)" style: "Select (V)", "Doc card (N)"), `aria-pressed` on tools, and the shapes flyout is announced as a menu.
- **Canvas:** `role="application"`, `aria-roledescription="whiteboard"`, and a hidden description. `LiveAnnouncer` (polite live region) speaks tool changes, selection changes and local create/delete.
- **Keyboard-only flows** (`a11y/keyboard.ts`):
  - Enter with a creation tool makes the element at the center of the view and selects it (text goes straight to typing).
  - Tab / Shift+Tab on the canvas select objects in reading order (`a11y/readingOrder.ts`), bringing them into view.
- **Shortcuts dialog** (`?`): generated from the registry, grouped, with platform key labels and a search filter. It notes that Mod+Alt+Arrow connects by keyboard.
- **Help menu** next to the zoom controls: Keyboard shortcuts, Show tips again, About.
- **Onboarding:** three tips anchored to the toolbar, the connector tool and the doc card tool, shown on the first board (pref `onboarded`), with Next / Skip.
- **Focus ring:** a zero-specificity global `:focus-visible` outline (2 px accent, offset 2), so every control has one; components with their own ring keep it.
- **Reduced motion:** animations and transitions are cut globally, card hover lifts are `motion-safe` only, `animateTo` was already instant and the pulse static.
- **Touch:** on coarse pointers, selection handles are 14 px with a 14 px hit radius, and toolbar buttons are 44 px.

**Dark mode audit** (screenshots of a board with every element kind, the style popover, the shortcuts dialog and the tips):
- Default-ink (`#1e1e1e`) strokes and text drawn on the canvas render as `--ink` (`#e9e9ee` in dark): shape outlines, line-art shapes, plain text, pen strokes, connectors with their markers and labels. Render-time only (`elements/common.ts` `ink`); data and exports keep the authored color.
- Sticky text stays dark. Menus, dialogs, tips and the toolbar are readable.
- Fixed: the checkbox in a (white) canvas doc card followed the dark scheme; canvas card bodies now use `color-scheme: light` (focus mode follows the theme).

**Deviations:**
- **Tab doesn't trap focus:** past the last (or before the first) object, Tab leaves the canvas instead of wrapping.
- **Shape text on a solid fill keeps its authored color** in dark mode (light text on a white shape would be unreadable). It maps only when the shape is unfilled, semi-filled or line art. Pen strokes are mapped too (the step listed shapes, text and connectors).
- Deleted elements are announced generically ("Element deleted", "3 elements deleted").
- Axe excludes the world layer's internals (`[data-testid="world"]`): they are user content in any authored color, hit-tested in code; the canvas itself is the accessible object.
- e2e: `createBoard` marks the browser as onboarded, so the first-run tips don't sit over the canvas in every test; `onboarding.spec.ts` opts in.
- **Bug caught before commit:** the first version of the roving tabindex watched `tabindex` with a MutationObserver and also wrote it, which looped and hung the page (the whole e2e suite timed out). It now watches only `aria-pressed` and writes only real changes.

**Dependencies added:** `@axe-core/playwright` 4.13.0 (dev).

**Follow-ups:** Manual checks not done: a full keyboard-only pass of the start page and board by hand, and a VoiceOver/NVDA spot check of the announcements. The actor shape's label overlaps its figure (not dark-specific).

**Verification:** pnpm verify ✅ (593 unit tests; new: reading order and Tab stepping, announcement texts, ink mapping) · pnpm test:e2e ✅ (136; new `a11y.spec.ts` (6), `keyboard-only.spec.ts`: R → Enter creates a rectangle → Enter edits → type → Escape → ArrowRight ×10 moves 10 px → `?` opens the dialog, search filters, Escape closes; Enter creation for sticky, doc card, frame and text; Tab order a → b → c then out of the canvas; toolbar arrows/Home/End with a single tab stop; `onboarding.spec.ts`: three tips once, again from Help, About).

## Step 32 (in progress) — Full E2E and deployment — 2026-10-03
**Done so far** (commit `e55a9fe`):
- **Security headers and CSP.** `static/_headers` and `_redirects`; the theme script moved to `static/theme-init.js`. SvelteKit's inline bootstrap script changes per build, so `scripts/postbuild-csp.mjs` (part of `pnpm build`) adds its sha256 to `script-src` in `build/_headers`. No `'unsafe-inline'` for scripts.
- **E2E runs against the real static output.** `scripts/serve-build.mjs` serves `build/` with the SPA fallback and the headers from `_headers`; Playwright uses it instead of `vite preview`. `csp.spec.ts` checks the header and that home, template previews, a doc card editor, the export preview and the service worker cause no violations.
- **Zod runs without `eval`** (`shared/zod.ts`, `jitless`): its fast path probes `new Function`, which the CSP reports as a violation.
- **`tabs-sync.spec.ts`**: create, move and type across two tabs; remote changes stay off the local undo stack.
- **Visual regression**: `pnpm fixtures` (`scripts/make-fixtures.ts` loads `src/lib/dev/visualFixture.ts` through Vite) writes `tests/e2e/fixtures/visual-board.smthng` with every element type, routing and marker. `visual.spec.ts` compares the canvas in light and dark (Chromium, local only: baselines depend on the machine's fonts; tolerance 0.1 %).
- **Bug found by the baselines and fixed:** the database shape's lid was an unfilled hole (the lid arc ran against the body under the nonzero fill rule).
- **Browsers:** `firefox` and `webkit` projects; `pnpm test:e2e` runs Chromium, `pnpm test:e2e:all` runs all three; offline and perf-guard are Chromium-only. CI runs a browser matrix with cached browsers, 2 retries and 2 workers, and uploads reports and traces on failure.
- README (features, data & privacy, development, testing, deploy, roadmap) and `CHANGELOG.md`.

**Still open:**
- Firefox: the first local run had failures (at least nine, mostly clipboard tests) that haven't been triaged. WebKit can't launch on this machine (needs Ubuntu system libraries); it runs in CI only.
- No deploy credentials in the environment: the manual steps are in README → Deploy.
- Version 1.0.0, the `v1.0.0` tag and Lighthouse are not done.

## Extra — Connect by dragging "+" — 2026-10-03 (commit `4415227`)
The "+" buttons were click-only (a click adds a connected copy of the same type), so connecting two existing objects needed the Connector tool or the small hover dots. Dragging a "+" now runs the same connect gesture as the dots (preview, target highlight, any object type); a click still adds a copy. e2e: `diagram.spec.ts`.

## Extra — Pages and Office-style layout — 2026-10-03
Requested by the human after step 31: "make it look a bit like office software, but keep simple" and "add page systems like in ms excel".

**Pages (data model change, D11 and §5 updated):**
- `model/pages.ts`: `meta.pages` lists `{ id, name }`; the first page (`main`) is the original `elements` map and other pages are `page:<id>` maps. `getElementsMap(doc)` returns the active page's map; the active page is per-tab view state (a WeakMap), so ops, the store, tools, clipboard and export work on one page with no changes.
- Schema version 2 (no data moves). The bump stops an older app from opening a multi-page board, whose asset cleanup would not know about the other pages.
- Whole-board code uses every page: asset cleanup (`gcAssets`), `.smthng` import (validation and asset remap), board duplication, and the undo manager's scope.
- `board/pages.svelte.ts` (`ctx.pages`): select, add, rename, move, remove, reveal. Switching ends editing, clears the selection, rebinds the store (`BoardStore.rebind`) and restores that page's view (kept per session; a page seen for the first time fits its content). The last shown page is remembered per board in localStorage.
- Undo follows pages: each undo step records the page it changed, and undo/redo switch to it first.
- Deleting a page removes its elements and doc card contents (origin `PAGES`, not undoable), clears the undo history, and asks for confirmation. The last page can't be deleted.
- Mentions and `?doc=` links find objects on other pages and switch to them. Connectors and mention suggestions stay within a page.
- Export "Board" is now "Page" (the current page); the file name gets the page name when there are several.

**Layout:**
- Title bar, then a docked ribbon (`Toolbar`) with labelled groups (Select, Draw, Insert, Options), the canvas, and a status bar (`StatusBar`) with the sheet tabs (`PageTabs`), an object/selection count, zoom and help.
- Sheet tabs: click to switch, double-click or F2 to rename, right-click or the menu key for Rename / Move left / Move right / Delete, arrow keys between tabs, "+" to add.
- A board opened without a saved view now fits its content (templates and imports no longer open half off-screen).

**Verification:** see the commit; unit tests for the page model, page state, cross-page undo, asset cleanup and multi-page import/duplicate; `pages.spec.ts` e2e.

## Extra — Sketch tool — 2026-10-03
Requested by the human: "drawing but not that will save every stroke as separate object (like real sketching tool with few brushes and pressure support)".

**Summary:**
- New element type `sketch` (schema version 3, D12 and §5 updated): one object holding many brush strokes. Strokes are plain objects `{ b, c, s, p }` in an append-only `Y.Array` per sketch in `doc.getMap('sketches')`. The element stores the rectangle `(bx, by, nw, nh)` of stroke space it shows; adding a stroke grows that rectangle and the box together, so earlier strokes never move and are never rewritten.
- `sketch/brushes.ts` (pure): pen and pencil (perfect-freehand outline, width follows pressure; mouse input simulates it from speed), marker, highlighter, eraser. One `strokePaint()` gives SVG path data and paint settings used by the canvas, the live preview and SVG export.
- `SketchView`: one `<canvas>` per sketch, redrawn when strokes change or the zoom crosses a power of two (resolution capped at 4,096 px a side). The eraser paints with `destination-out`, so it really erases inside the sketch. Default-ink strokes follow the theme.
- Tool (B, "Sketch" in the Draw group): a session draws into one object. Picking the tool with a sketch selected, or double-clicking a sketch, continues it; leaving the tool selects it; "New sketch" starts another. The ribbon shows contextual groups: Brush, Size, Color.
- Sketches are hit on their strokes only (not their whole box), connectable like any object, resizable (aspect kept by default), not rotatable.
- Everything that handles doc card contents handles strokes too: delete and undo, duplicate, copy/paste (strokes travel in the clipboard payload), page deletion, the undo scope, PNG/SVG export (erasers become SVG masks) and thumbnails.
- The existing Pen tool (one object per stroke) is unchanged.

**Deviations / notes:**
- The live preview of an eraser stroke is a grey band; the erasing shows when the stroke is released.
- An eraser stroke never grows the sketch, and does nothing before a sketch exists.
- Bounds leave room for full pressure: a pen stroke can reach 0.8 × its size from the center line.
- Stylus pressure is tested through the Chromium DevTools protocol (`pointerType: 'pen'`, `force`); it has not been tried with a physical stylus.

**Verification:** unit tests for brushes, frame growth, moved and resized sketches, hit testing, undo, duplicate, delete and SVG export; `sketch.spec.ts` e2e (one object per session, undo per stroke, reload, erasing measured on canvas pixels, continue and "New sketch", stylus pressure, vector export); the visual fixture includes a sketch.

## Extra — Doc card freeze when editing again — 2026-10-02
Reported by the human: a doc card froze the page when manipulated.

**Cause:** editing the body of an existing card (double-click or Enter) looped an effect forever. `DocCardView`'s editable/focus effect focuses the editor, which dispatches a transaction synchronously; `BubbleMenu`'s transaction listener ran `tick++` inside that effect, so the effect both read and wrote `tick` and invalidated itself. A just-placed card was not affected (its first focus happens before the listener is attached), which is why no e2e test caught it.

**Fix:**
- `BubbleMenu`: the transaction listener bumps `tick` inside `untrack`.
- `DocCardView`: the imperative editor calls in the editable/focus effect run inside `untrack`, so the effect depends only on `editor` and `part`.

**Notes:**
- The page hangs (about a minute) only on the dev server, where Svelte records a stack for every looped update. A production build runs the loop to Svelte's limit quickly, throws `effect_update_depth_exceeded` repeatedly and carries on, so the e2e test asserts that no page error is thrown.
- `render.spec.ts` "culling keeps off-screen elements out of the DOM" failed once in the full parallel run (it counted elements before the first cull) and passed 3/3 alone; it doesn't involve doc cards and was left as is.

**Verification:** pnpm verify ✅ · pnpm test:e2e: 151 passed, 1 failed (the culling test above, passing on its own) · new e2e in `doccard.spec.ts` (re-enter a card by double-click and by Enter, type both times, no page errors); without the fix it fails with `effect_update_depth_exceeded`.

## Extra — Flaky culling e2e test — 2026-10-02
`render.spec.ts` "culling keeps off-screen elements out of the DOM" sometimes rendered all 3,000 elements. The canvas sets a board's initial view asynchronously (after its first size measurement and a storage read), and a board without a saved view fits its content. When the test created the elements before that, the view was fitted to them at 10 % zoom and nothing was off-screen. The app behaved as designed; the test raced it.

**Fix (test only):** `waitForInitialView` in `tests/e2e/helpers.ts`, used by the culling test before it creates the elements.

**Verification:** creating the elements as soon as the hooks exist reproduced the failure 6/6 (zoom 0.1, 3,000 rendered); after waiting for the view, 6/6 gave zoom 1 and 101 rendered. The test passed 10/10 with `--repeat-each=10`; pnpm lint and pnpm check ✅ · pnpm test:e2e ✅ (152).

## Extra — Dragging big doc cards — 2026-10-02
Requested by the human: "make dragging big doc cards faster". Measured before: a card with 1M characters dragged at 100 ms per frame, 5M at 450 ms (headless Chromium, production build).

**Cause:** not script, layout or paint. A trace showed 95 ms of every frame in Blink's `EditingUtility::previousCandidateAlgorithm`. After editing ends the caret stays in the card's text, which is then read-only and `user-select: none`; on every style change the browser looks for a valid caret position and walks the whole document without finding one. It happened on any frame while such a selection existed, not only while dragging that card.

**Fix:** `DocCardView` removes the selection from the card when body editing ends.

**Measured after:** 17 ms per frame (60 fps) at 1M and at 5M characters. Leaving editing also got faster (279 → 188 ms at 1M). Typing and reopening are unchanged (30 ms per key and 2.3 s at 1M).

**Verification:** `perf-guard.spec.ts`: after Escape no selection is left inside the card. pnpm verify ✅.

## Extra — Word-like formatting for doc cards — 2026-10-03
Requested by the human: "in doc cards make text editing more versatile (when editing doc - show ms word like menu to edit text, not much, but colors, styles, aligning, font etc)".

**Summary:**
- `DocRibbon.svelte`: three ribbon groups. Style (Normal text, Heading 1–3, Quote, Code block); Font (font, size, bold, italic, underline, strikethrough, text color, highlight, clear formatting); Paragraph (bullet, numbered and checklist, align left/center/right/justify). The Toolbar shows them while a canvas card's body is edited (`activeDocEditor`, set by `DocCardView`); focus mode shows them in a toolbar under its header.
- Content (`formatting.ts`, schema version 4): underline from the starter kit, plus one mark per property (`textColor`, `highlight`, `fontFamily`, `fontSize`) holding an id from `formatOptions.ts`, and an `align` attribute on paragraphs and headings (left is not stored). They render as `data-*` attributes only; `prose.css` gives the look. No inline styles, nothing unchecked reaches CSS, pasted or imported values off the lists are dropped, and colors can follow the theme (lighter text colors in dark focus mode; canvas cards stay light).
- Fonts are system stacks (default, serif, monospace), nothing is downloaded. Sizes are relative to the card's font size (small, large, huge).
- `formatCommands.ts` reads and applies the formatting with type-only TipTap imports, so the ribbon doesn't pull the lazy editor chunk into the board bundle. Changing the style of several blocks keeps each block's alignment and skips empty lines (the stock commands drop alignment on multi-block selections).
- Menus give the focus back to the text synchronously when they close (`commands.focus()` waits a frame, and a key pressed before it went to the toolbar).
- The color marks wrap bold/underline/strike (priority 150), so underlines and strike lines take the text color.

**Bug fixed on the way:** Ctrl/⌘+Enter in an edited card opened focus mode *and* inserted a hard break into the text (TipTap's hard-break shortcut). The card now takes the key in the capture phase, before the editor.

**Deviations / notes:**
- Schema version 4 (no data moves): an older app would delete text with the new marks (y-prosemirror drops text whose marks it can't build), so it must not open these boards.
- Markdown export and PNG/SVG export keep the text but not the colors, fonts, sizes, underline or alignment (Markdown has no syntax for them; the static renderer draws plain lines).
- No new dependencies: the marks are small custom TipTap extensions instead of `@tiptap/extension-text-style` / `-text-align`, which write inline styles with arbitrary values.

**Verification:** unit tests (`formatting.test.ts`: every choice as a data attribute, replace and reset, values off the list ignored when applied or pasted, several marks from one span, mark nesting, clear formatting, alignment incl. pasted `text-align`, block style switching, multi-block alignment kept, Yjs round trip and sync, Markdown keeps plain text, prose.css styles every id) · e2e `doc-format.spec.ts` (ribbon only while editing, every control keeps editing and focus, formatting persists after reload, caret formatting applies to typed text, clear formatting, focus mode toolbar, Escape closes a menu but not focus mode, Ctrl+Enter adds no line break). pnpm verify ✅ (647 unit tests) · pnpm test:e2e ✅ (156) · `doc-format.spec.ts` 30/30 with `--repeat-each=10`. The focus-mode test first failed 2 in 24 runs: a key typed about 4 ms after End (after Select all) replaced the text because the editor hadn't read the collapsed selection yet. Only a script types that fast; the test now waits for the caret.

## Extra — More fonts and colors for everything — 2026-10-03
Requested by the human: "more fonts and overall colors (for everything)". Answers to the clarifying questions: fonts for doc cards *and* canvas text; bundled web fonts within about 1 MB; a bigger palette plus any color.

**Fonts:**
- `src/lib/fonts/catalog.ts` (pure): 13 fonts in four categories — Default, Inter, Montserrat, Oswald, Comfortaa; Serif (system), Lora, Roboto Slab, Playfair Display; Monospace (system), JetBrains Mono; Caveat, Pacifico. Bundled ones use the family `SMTHNG <name>`, so an installed copy (e.g. Inter) never stands in for them.
- `files.ts`: Latin, Latin Extended and Cyrillic woff2 subsets of each bundled font, imported with `?url` from the `@fontsource*` packages: 30 files, 998,796 bytes. `register.ts` adds them with the `FontFace` API (with Google's unicode ranges) when a board opens; the browser downloads a file only when text needs it. The PWA precaches them (`woff2` was already in its patterns), so they work offline. It also adds the doc card `[data-font]` rules as a constructed stylesheet generated from the catalog (they left prose.css).
- Canvas text: `style.font.family` (optional font id) on shapes, sticky notes, text and doc cards (the card's base font for its body); a grouped font list (each name in its own face) in the style popover's Text panel. `fontToCss` and the static renderer use the stack.
- Doc card text: the ribbon's Font menu lists every font; the ids `serif` and `mono` from the previous step keep their meaning.
- Export: `renderScope` waits for the fonts in use, measures with them, and embeds their files as data URLs in an SVG `<style>` (only fonts in use); PNG export rasterizes that SVG, so it shows them too.

**Colors:**
- `palette.ts`: a 10-column grid — a gray row (9 grays plus transparent or pure black) and four shades (open-color 2, 4, 8, 9) of red, orange, yellow, lime, green, teal, blue, indigo, violet and pink. The previous palette is the third shade row and keeps its names ("Red"); the others are "Pale/Light/Dark red". Sticky notes: two pastel rows plus white and grays, the previous sticky colors among them.
- `ColorSwatches`: the grid, a "Recent" row (custom colors, newest first, max 10, per browser via localPrefs `smthng:recentColors`), a native color picker and a hex field (3 or 6 digits, with or without `#`). Used for fill, stroke, text, sticky (custom now allowed), the sketch ribbon ("More colors" next to ten quick swatches) and doc card text/highlight.
- Doc card text color and highlight take any `#rrggbb`: rendered as `data-color="custom"` with `--doc-color` (or `--doc-highlight`) in the style attribute, parsed back only when the value is a hex color. In dark focus mode such text is lightened with relative color syntax (`oklch(from … max(l, 0.72) …)`) so dark colors stay readable. The 8 token colors of the previous step still render.
- Style panels scroll within the available height (`--bits-floating-available-height`).

**Deviations / notes:**
- No schema bump for `style.font.family`: an older app parses the element (zod drops the key), shows the default font and keeps all text; only restyling there would drop the font.
- Thumbnails and template previews don't embed fonts (they fall back); exports do.
- Text measured before a font finished loading (e.g. an auto-width text) is not re-measured when it arrives.
- e2e locators for "Red", "Green" and "Blue" swatches are now `exact` (the palette also has "Pale red" etc.); the checks are unchanged. The doc-format tests pick colors from the new picker; preset colors are now stored as hex.

**Dependencies added:** `@fontsource-variable/{inter, montserrat, oswald, comfortaa, lora, roboto-slab, playfair-display, jetbrains-mono, caveat}` and `@fontsource/pacifico`, all 5.3.0 (OFL-1.1; Roboto Slab Apache-2.0). Only the 30 imported files ship.

**Verification:** unit tests (`fonts.test.ts`: unique ids, a file per subset for every bundled font, fallbacks, doc card rules; `palette.test.ts`: full rows, unique values and names, original colors kept under their names, hex normalizing; `recentColors.test.ts`; `formatting.test.ts`: hex colors applied, read back and rejected when not hex, every catalog font; `staticSvg.test.ts`: per-text font-family and embedded rules; `schema.test.ts`: font family kept, optional, length-limited) · e2e `fonts-colors.spec.ts` (bundled font on canvas text incl. Cyrillic, persists after reload; hex fill, palette shade, Recent offered for a sticky; doc card font and hex color from the ribbon; sketch "More colors"; SVG export embeds only the fonts in use) · pnpm verify ✅ (659 unit tests) · pnpm test:e2e ✅ (161) · `fonts-colors` + `doc-format` 40/40 with `--repeat-each=5`.

## Extra — Optimization phase 0: measurements — 2026-10-03
Requested by the human: an optimization plan, then "phase 0" (measure the cases step 30 didn't).

**Summary:**
- `tests/e2e/perf-bench.spec.ts`, run with `pnpm bench` (skipped in `test:e2e`). It runs on a 3,000-element mixed board, one pointer move per frame for 60 frames, and records frame times, DevTools main-thread metrics, instrumented app time and Y.Doc updates. It prints a table; `PROFILE=1` also saves a `.cpuprofile` per scenario in `test-results/`.
- `timed()` in `dev/testHooks.ts` (a no-op unless test hooks are on), around `BoardStore` change handling (`store.apply`), element reads (`store.read`) and culling (`layer.cull`).

**Results** (headless Chromium, software rendering, this machine; two runs agreed within 1 fps; per-frame values in ms):

| Scenario | fps | p95 | script | task | store.apply | Y updates / KB |
|---|---|---|---|---|---|---|
| Pan @ 100 % | 60 | 16.7 | 0.4 | 4 | – | – |
| Pan @ 50 % | 60 | 16.7 | 0.4 | 9.4 | – | – |
| Pan @ 10 % (all visible) | 29 | 66.7 | 0.5 | 31 | – | – |
| Drag 1 of 3k | 59.5 | 16.7 | 1.6 | 5 | 0.1 | 56 / 3 |
| Drag 100 selected @ 50 % | 36 | 50 | 7.5 | 19 | 2.0 | 58 / 182 |
| **Drag 300 selected @ 50 %** | **27** | 83 | 15.8 | 30 | 4.4 | 58 / 557 |
| Frame + 200 children @ 35 % | 58 | 16.8 | 6.9 | 9.8 | 1.8 | 60 / 434 |
| Remote tab, 300 dragged elsewhere | 52 | 33 | 5.3 | 9.8 | 2.6 | 58 / 537 |

**Findings:**
- **Dragging many elements is the new weak spot**: it scales with the selection (300 → 27 fps). A CPU profile of the 300 drag (unminified build) splits the JS roughly 30 % `updateElements`, 27 % `BoardStore.#apply`, 36 % Svelte updates. The rest of each frame is the browser painting.
- **zod runs three times per moved element per frame**: `updateElements` parses the current element and the patched result, then the store parses it again when it reads the change. Together that's about a quarter of the drag's JS time.
- Svelte work per moved element: `ElementView`'s style string, `ShapeView`'s path derived again (only x/y changed), connector geometry, and one selection outline per selected element.
- Moving a frame with 200 children (58 fps), a remote tab following a 300-element drag (52 fps) and culling (≤ 0.1 ms/frame) are fine.
- Storage: a one-second drag of 300 elements writes 58 Y updates (557 KB) to IndexedDB and the tab channel. The receiving tab handles that in ~5 ms of script per frame, so throttling it isn't worth doing yet.
- Pan with everything visible at 10 % zoom: 29 fps (step 30 recorded 33 with a different pacing method). It's still browser painting; app script is 0.5 ms/frame.

**Follow-ups (for phases 2–3 of the plan):** skip the double zod parse for local patches in `updateElements` and the store's re-parse of LOCAL changes; keep ShapeView/ElementView work independent of x/y; then re-run `pnpm bench`.

**Dependencies added:** none
**Verification:** pnpm verify ✅ (659 unit tests) · `perf-guard` + `tabs-sync` e2e ✅ · `pnpm bench` ✅ (two runs)

## Extra — Optimization phase 1: canvas rendering when zoomed far out — 2026-10-03
Approved by the human ("phase 1"; step 30 had left a canvas renderer out of scope until approved).

**Summary:**
- `render/canvasScene.ts` (`SceneRenderer`): Canvas 2D drawing of every element type (shapes, stickies, text, images, strokes, sketches, frames, doc cards, connectors with markers and labels). Paths are cached per element and rebuilt only when their shape changes; sketches are cached as small bitmaps. Text is drawn with real glyphs while it's at least 4 px on screen, and as bars ("greeked") below that.
- `canvas/SceneCanvas.svelte`: one canvas covering the view, placed in world space so the world transform maps it 1:1 to the screen. It redraws in the same update as the DOM, so it never lags a pan.
- `ElementsLayer` switches to the canvas when zoom < 30 % **and** at least 400 elements are near the view (`useSceneCanvas`, with hysteresis on the count). Sparse boards keep DOM rendering at any zoom. The edited element stays a DOM view above the canvas.
- Grid: the CSS `radial-gradient` dots became a small SVG tile image (power-of-two sizes, `canvas/grid.ts`). While the scene canvas is shown, it paints the grid itself and the CSS grid is off (one layer composites faster).

**Results** (`pnpm bench`, headless Chromium, software rendering):

| Scenario | Before | After |
|---|---|---|
| Pan @ 25 % (3k mixed) | DOM, ~1,100 nodes | 60 fps |
| Pan @ 10 % (3k mixed) | 29 fps, 31 ms main thread/frame | 35–42 fps, 10 ms main thread/frame |
| Drag 300 selected @ 20 % | — | 30–37 fps |
| Other scenarios | unchanged within noise | |

**Deviations / notes:**
- At 10 % the main thread is mostly idle now. What remains is raster/compositing in the software renderer. The dot grid alone costs about a third of the frame rate there (in-page loop: 42 fps with the grid, 60 without). Neither a separate grid canvas nor an inline SVG `<pattern>` was faster (measured, reverted). Not measured on a real GPU.
- The canvas has no element shadows, and connector labels sit at their route position without wrapping.
- `ViewportState.sceneCanvas` tells the canvas background to drop its grid while the scene canvas is shown.

**Dependencies added:** none
**Verification:** pnpm verify ✅ (666 unit tests; new `canvasScene.test.ts`, `grid.test.ts`) · pnpm test:e2e ✅ (162; new in `perf-guard.spec.ts`: a 3k board at 10 % is one painted canvas with no element DOM, and back to DOM at 100 %) · screenshots compared at 31 % (DOM) and 29 % (canvas).

## Extra — Optimization phases 2–3: cheaper drags of many elements — 2026-10-03
Requested by the human ("step 2 and 3"). Targets were the hot spots measured in phase 0 and a fresh CPU profile of the 300-element drag.

**Summary:**
- **One validation per moved element instead of three.** `updateElements` validates only the merged result (the stored element is validated only when that fails, to keep skipping invalid stored data). It hands that result to the observers of its own transaction (`rememberWritten` / `forgetWritten` in `model/doc.ts`), so `BoardStore` doesn't parse the same data again. Entries are dropped as soon as the transaction ends, and only kept when the Y.Map holds exactly the validated fields. Changes from other tabs, undo or imports are still read and validated from the map.
- **Selection outlines are one `<path>`** instead of one `<polygon>` per selected element.
- `ShapeView` memoizes its path (`shapePathMemo`): a move no longer rebuilds it.
- `ElementView` sets one derived style string instead of a style attribute merged with three `style:` directives.

**Results** (`pnpm bench`; per-frame ms):

| Scenario | fps before → after | script | store.read |
|---|---|---|---|
| Drag 100 selected @ 50 % | 36 → 44 | 7.5 → 4.9 | 0.6 → 0 |
| Drag 300 selected @ 50 % | 27 → 31 | 15.8 → 11.9 | 1.6 → 0.1 |
| Drag 300 selected @ 20 % (canvas) | 30–37 → 36 | 15.9 → 11.4 | 1.7 → 0.1 |
| Frame + 200 children @ 35 % | 58 → 59 | 6.9 → 5.5 | 1.0 → 0.1 |
| Others | unchanged within noise | | |

**Deviations / notes:**
- Phase 3 was planned as splitting `store.version` into finer signals. The profile showed everything that reads it costs under 60 ms per 60-frame drag together, so the work went to the measured hot spots (selection outlines, ElementView, ShapeView) instead.
- One style string costs a little more style recalc (1.9 → 2.5 ms/frame for 300 elements) and saves more script time.
- What's left in a 300-element drag: the Yjs transaction itself (~10 KB of updates per frame) and Svelte's own bookkeeping, then the browser painting (about half of each frame).

**Dependencies added:** none
**Verification:** pnpm verify ✅ (669 unit tests; new in `ops.test.ts`: invalid stored data is skipped, observers get the written element while later reads come from the map, stale keys fall back to parsing) · pnpm test:e2e ✅ (162, including the perf guard's render counts and the visual snapshots) · `pnpm bench`.

## Extra — Drop text, Markdown and Word files — 2026-10-03
Requested by the human: "can we add drag&drop for txt, gifs, webp, md, docx?". GIF and WebP drops already worked (`ACCEPTED_TYPES`); the rest is new.

**Summary:**
- `board/files/`: `fileKinds.ts` detects text, Markdown and Word files, by extension first (browsers often report no type for `.md`). `importFiles.ts` is the drop handler: images go through the existing image import, documents become doc cards. Everything added is selected.
- `importDocs.ts` (lazy chunk) converts each file to HTML, maps that onto the doc card schema with ProseMirror's DOM parser, and writes it to a new 480 × 560 card titled with the file name. Creating and filling the card is one transaction, so one undo step.
  - Text: blank lines separate paragraphs, single line breaks stay line breaks.
  - Markdown: `marked` (GFM). Task lists become checklists.
  - Links other than http(s)/mailto are unlinked. Elements the schema doesn't know (scripts, images, tables) are dropped.
- `docx.ts`: a small converter with no dependency. It unzips with `DecompressionStream`, reads `document.xml` with `DOMParser`, and handles headings (from style names, so localized style ids work), bold/italic/underline/strike, tabs and breaks, external links, and bullet/numbered/nested lists (from `numbering.xml`). Tables are flattened to paragraphs.
- Files over 10 MB, and `.docx` files that aren't Word documents, show an error toast.

**Deviations / notes:**
- `importDocs` writes the card and its content in one `doc.transact(…, LOCAL)` around `createElements` and `setDocContent` (like templates), rather than a new helper in `model/ops.ts`.
- Not supported: `.doc` (the old binary format), images inside Word files, and pasting these files from the clipboard (only image paste exists).
- `templates/docContent.ts` now exports `docSchema`.

**Dependencies added:** `marked@18.0.14` (MIT): the Markdown parser, in the lazily loaded import chunk (15.6 KB gzipped together with the importer). `mammoth` was the alternative for `.docx`, but it adds about 170 KB gzipped, so `.docx` uses the small converter instead.
**Verification:** pnpm verify ✅ (682 unit tests; new `docx.test.ts` on hand-built zips with stored and deflated entries, and `importDocs.test.ts`) · pnpm test:e2e ✅ (165; new `file-drop.spec.ts`: Markdown → formatted card with checklist, one undo step; `.txt` + a real `.docx` fixture → two selected cards, unsupported file ignored; a fake `.docx` shows an error).

## Step 33 — Insertable templates — 2026-10-03
**Summary:**
- `templates/insert.ts` (lazy): `insertTemplate(ctx, t)` builds the template into a temporary doc, clones it with new ids, centered on the view, and adds it with `createWithContent`: one LOCAL transaction (one undo step), doc card contents and sketch strokes copied, frame membership synced, everything selected. The bounds include connectors (via their geometry). When the template doesn't fit the view, the view zooms out to it (`viewport.fit`).
- `Template` gained `category`, `keywords` and `featured`, and `searchTemplates` matches every word.
- `shared/ui/TemplateGallery.svelte`: a dialog with search, category chips, a preview grid (rendered on first open, cached per session) and arrow-key navigation. It's used by the board (Insert → Templates button, Shift+T, "Insert template" in the shortcuts help) and by the start page ("More templates", which creates a board). The start page row shows featured templates only; "More templates" appears once there are non-featured ones (step 34).
- The gallery and the insert code load on first open (dynamic imports, checked in the build output).

**Deviations:**
- No new `insertElements` was extracted from `pastePayload`: `commands/edit.ts` already had `createWithContent`, which does exactly that.
- The "zooms out" unit test spies on `viewport.fit`; jsdom's animation frames don't advance the eased animation.
- Two existing tests were flaky under the heavier full run and are fixed without changing what they check:
  - `recentColors.test.ts`: the module's first import (compilation) now happens in `beforeAll`, outside the 5 s test limit.
  - `doccard.spec.ts` "markdown shortcuts": the second tab's 1 s window included loading the board and the lazy editor. It now waits for that editor, then checks syncing within 1 s (2/5 failures before, 8/8 passes after).

**Dependencies added:** none
**Verification:** pnpm verify ✅ (689 unit tests; new `insert.test.ts`: every template inserts as consistent new elements that are selected and undone in one step; centered; doc card text copied; two inserts are independent; fit only when too big; search) · pnpm test:e2e ✅ (166; new in `templates.spec.ts`: toolbar → gallery → search "brain" → insert → selected; one Ctrl+Z removes it; Shift+T opens the gallery).

## Step 34 — Template pack (kanban and friends) — 2026-10-03
**Summary:**
- Nine templates, each its own lazy module and chunk: **Kanban** (featured), Retrospective, SWOT analysis, Eisenhower matrix, Mind map, Timeline, User journey map, Business model canvas, Weekly planner (with a "Notes" doc card checklist). They're built from frames, stickies, shapes, text, doc cards and connectors only.
- `TemplateBuilder`: `frame()` takes a style, `frameGrid()` lays out rows/columns of frames, and `TINTS` gives frames a pastel at 25 % with a deeper outline, readable in light and dark mode.
- **"Stack contents"** (canvas context menu, for a single selected frame with unlocked children): `stackInFrame` (pure, `engine/align.ts`) stacks the children in reading order at 16 px padding, 12 px apart, and grows the frame when they don't fit (so none of them leaves the frame). One undo step. It never runs by itself.
- The start page shows 4 featured templates (Kanban, Flowchart, Brainstorm, Meeting notes) and a "More templates" card that opens the gallery.

**Deviations:**
- "Stack contents" is in the context menu only (no shortcut); the Arrange panel is for multi-selections.
- The User journey map is one frame with text headers and stickies in the cells (nested frames are a non-goal); the Business model canvas is nine side-by-side frames.
- The timeline's line is a thin filled rectangle with circle markers; milestones connect with straight connectors, and each quarter label sits on the side without a connector.
- Gallery fix found by screenshots: grid rows now use `max-content`. Cards with `overflow: hidden` could be squeezed by the dialog's height and hid their names.
- e2e and a11y tests that counted 3 template previews on the start page now expect 4 (the featured set grew; intended).

**Dependencies added:** none
**Verification:** pnpm verify ✅ (726 unit tests; `templates.test.ts` now also checks for every template: no overlapping stickies within a frame, no overlapping frames, fits in 4,000 × 3,000; content checks for kanban, the business model canvas and the weekly planner; `align.test.ts` / `arrange.test.ts` for stacking) · pnpm test:e2e ✅ (169; new: insert Kanban → drag a card to Done → its frame changes → "Stack contents" stacks it under the existing card; "More templates" → Strategy → SWOT creates a board; visual baseline of the gallery) · screenshots of the gallery (light/dark) and of Kanban (light/dark), Mind map, Timeline, User journey map, Business model canvas and Eisenhower matrix reviewed.

## Step 35 — Media element — 2026-10-03
Approved by the human ("approved, start step 35"): new element type, schema version 5, CSP change.

**Summary:**
- **Model:** `MediaElement` (`url`, `provider`, `mediaId`, `start`, `end`, `loop`, `title`), validated by zod (https only, ≤ 2,048 chars; id `[\w-]{1,64}`; title ≤ 200). Schema version 5, no data moves. `end`/`loop` are stored now for step 36. Default 480 × 270 (audio 360 × 96), dark card, aspect kept, not rotatable.
- **Links** (`board/media/parseMediaUrl.ts`): YouTube (watch, youtu.be, shorts, embed, live, nocookie; `t=`/`start=`), Vimeo (`vimeo.com/<id>`, channels, player; `#t=`), video/audio files by extension. http, credentials, lookalike hosts and bad ids are rejected. Embeds are built from the id only: `youtube-nocookie.com/embed/<id>?autoplay=1&rel=0&playsinline=1[&start]` and `player.vimeo.com/video/<id>?dnt=1&autoplay=1[#t]`.
- **View** (`elements/media/MediaView.svelte`): a poster (play button, title, provider · host, clip/start, loop badge, "Offline: can't play", "Can't play this file") until playback starts. Nothing is requested before that. Then an iframe (sandboxed, `allow` for autoplay/fullscreen/PiP) or a native `<video>`/`<audio>` with controls. The player's src is fixed when playback starts, so moves don't reload it.
- **Playing / interacting:** `PlaybackState` (board context, per tab) holds the playing ids. Double-click or Enter plays and enters the editing mode, where the player takes pointer events (its own controls). Escape or a click elsewhere leaves it and playback continues. The Play/Stop button in the style popover and the context menu (Play/Stop, Open link, Copy link) control it. Playing elements stay mounted when culled or when the scene canvas is shown; deleting stops them (pruned like the selection), and switching page stops all.
- **Creating:** paste a link on the board, drop a dragged link on the canvas, or use Insert → Media (popover with validation).
- **Elsewhere:** static SVG/PNG export, thumbnails and the scene canvas draw the poster; media can be @-mentioned by title, and Markdown export writes those mentions as `[title](url)`; a11y name "media".
- **CSP:** `frame-src https://www.youtube-nocookie.com https://player.vimeo.com; media-src 'self' blob: https:`. `connect-src` stays `'self'`.
- `00-architecture.md` updated: summary, §5 type and rules (schema 5, media behaviour, CSP), §9 registry note.

**Deviations:**
- Interaction reuses the existing editing mode (`selection.editingId`) instead of a separate "interacting" state: keys already go to the edited element, and Escape and outside clicks already end it.
- Markdown export passes a `link` lookup to `docToMarkdown` (held for the duration of the synchronous conversion), so other callers are unchanged.
- The e2e video fixture (`tests/e2e/fixtures/sample.webm`, 5.6 KB, 2 s) was recorded with Chromium's MediaRecorder; there's no ffmpeg here.
- An old preview server was still serving stale `_headers` during one e2e run; all preview servers were stopped and the run repeated.

**Dependencies added:** none
**Verification:** pnpm verify ✅ (770 unit tests; new `parseMediaUrl.test.ts` (all URL forms, start times, rejections), `media.test.ts` (creation as one undo step, audio size, schema rules, playback pruning, poster text, Markdown links); `staticSvg.test.ts` covers media and checks the poster never references the link; the connectable matrix includes media) · pnpm test:e2e ✅ (172; new `media.spec.ts`, network-free via routes: paste a YouTube link → poster with no third-party request → double-click → iframe with the nocookie embed URL → Escape keeps it playing → Stop → poster → undo; Insert → Media validation → a `.webm` link plays (Enter), stays mounted 5,000 px off screen, stops on delete; switching page stops playback; `csp.spec.ts` asserts the new directives) · screenshots of video/audio posters and a playing video reviewed.

## Step 36 — Rich media controls — 2026-10-03
**Summary:**
- **One controller, three adapters** (`board/media/controller.ts`, `native.ts`, `youtube.ts`, `vimeo.ts`). The native one wraps `<video>`/`<audio>` (PiP and text tracks where available). YouTube speaks the embed's postMessage protocol (`listening` until it answers, `command`s, `infoDelivery`); Vimeo speaks its postMessage API (`ready` → `addEventListener`s, `getDuration`/`getVolume`/`getPaused`, events). No provider script runs in the page, and messages are accepted only from that iframe's window and the provider's origin. A player that doesn't answer within 4 s falls back: its iframe reloads with the provider's own controls and the bar says "Using the player's controls".
- **Embeds** now load with `controls=0` (+ `enablejsapi=1&origin=…` for YouTube) so ours are the controls.
- **Session rules** (`session.ts`, `clip.ts`): personal volume, mute and speed (`smthng:media`) are applied when a player is ready. The clip is enforced (stop at `end`, or loop back to `start`), and Play at the end starts over from the clip start.
- **Controls bar** (`MediaControls.svelte` + `Scrubber`, `VolumeControl`, `MediaMoreMenu`) in the screen-space overlay (`MediaOverlay.svelte`), under the element (or over its bottom edge without room). It shows while selected, hovered or in use and lingers 2 s; compact under 280 px on screen. It has play/pause, ∓10 s, a seek bar (buffered, clip markers with the outside dimmed, hover time, drag with one seek per frame, arrow/Home/End keys), elapsed/remaining time, volume and mute, speed (hidden when refused), and More: Loop, Set start here, Set end here, Clear clip, Captions and Picture in picture (native only), Open link, Copy link at this time. Full screen puts the player box in full screen with the bar inside it.
- **Board data vs personal:** loop and clip edges are undoable `updateElement` writes (clamped); volume, speed and mute live only in this browser.
- **One at a time:** whenever a player starts (our controls, autoplay or its own button), the others pause. Setting: "Play one media at a time" in Settings, on by default.
- **Keyboard** (`keys.ts`): Space/K, J/L, ←/→, ↑/↓, M, F, `<`/`>`, 0–9, Home/End, Shift+L, for the media being used, or the selected one while it plays. They're listed in the shortcuts help (new "Media" group) and §11.
- `00-architecture.md`: §9 media controller, §11 shortcuts (media keys, Shift+T).

**Deviations:**
- Media keys win over tool keys, arrow nudging and Space-panning only while the selected media is playing (or in use). Otherwise those keys keep their usual meaning. `viewportInput` got a `spaceTaken` option for this.
- Speed steps use `<` / `>` (what Shift+, / Shift+. type).
- The native player has no browser controls any more; clicking the video toggles play while it's in use.
- e2e stand-ins `fixtures/fake-youtube.html` (time runs at 4×) and `fake-vimeo.html` (refuses speed changes) implement the protocol subset we use.
- Found while taking screenshots: starting two media quickly let both play, because only players already reporting "playing" were paused. Now the rule runs whenever any player starts.

**Dependencies added:** none
**Verification:** pnpm verify ✅ (790 unit tests; new `clip.test.ts`, `players.test.ts` (YouTube handshake, commands, info, ignored sources/origins/garbage, fallback, cleanup; Vimeo events, getPaused, refused speed, fallback; native state and controls), `controls.test.ts` (session prefs and clip enforcement, playInClip, undoable clamped clip writes, speed steps, keys with and without a target, one at a time incl. autoplay)) · pnpm test:e2e ✅ (179; new `media-controls.spec.ts`: play/pause/seek/time on YouTube; Set start/end + Loop → markers, loops, undo; volume/speed survive a reload and aren't on the element; a second media pauses the first and Vimeo hides speed when refused; Space/arrows/M on the selected playing media, arrows don't nudge, a doc card still gets spaces; bar height equal at 25 %, 100 %, 200 % and axe-clean; a silent player falls back) · `media-controls.spec.ts` 21/21 with `--repeat-each=3` · screenshots of the bar in light and dark reviewed.

## Step 37 — Mobile layout and touch navigation (+ Back to origin) — 2026-10-03
Requested by the human: "steps 37, 38 and button to return to canvas origin point".

**Summary:**
- **Phones (< 640 px), with Tailwind `max-sm:` and `pointer-coarse:`:**
  - Board top bar: logo, title, undo/redo, save status and Export as icons (labels for screen readers), Settings; the theme toggle moves into Settings.
  - The toolbar is a **bottom bar** (safe-area padding) with Select, Hand, Pen, Shapes, Sticky, Text and **"Insert more"** (Sketch, Eraser, Connector, Doc card, Frame, Image, Media…, Templates…). The media link popover can be opened from that menu (`mediaPromptState`, anchored to the menu button on phones). Group captions and the Options group are hidden.
  - Start page: logo only (no wordmark), full-width search, the theme toggle in Settings; the views become a 4-way segmented control.
  - Touch targets are 44 px under `(pointer: coarse)` (ribbon buttons, top bar, status bar, zoom controls); text fields use ≥ 16 px text (no iOS zoom on focus); `viewport-fit=cover` + safe-area insets.
- `shared/layout.svelte.ts`: reactive `compact` / `coarse` media query state.
- **Touch gestures** (`tools/touchGestures.ts`, pure, + `pointerRouter.ts`): with Select, one finger on empty canvas pans, long-press (500 ms) then drag draws a marquee, and a tap clears the selection. A double-tap is a double-click (edit, play, enter group). Touch `pointerdown` is `preventDefault`ed: the emulated mouse events after a tap moved focus and closed the editor a double-tap had just opened. Pinch: `viewportInput` dispatches `smthng:gesturecancel` when the second finger lands, and the router cancels the first finger's tool gesture.
- **Back to origin:** a button (`LocateFixed`) in the zoom controls and the **Home** key: the view returns to the origin at 100 %. Media keys still take Home while a media element plays.
- Playwright project **`mobile`** (Pixel 7, touch); `pnpm test:e2e` runs chromium + mobile. `tests/e2e/touch.ts` sends real touch events through CDP.

**Deviations:**
- The "⋯" overflow menu from the plan wasn't needed: on phones the top bar fits by turning Export and the save status into icons and moving the theme toggle into Settings (which already holds it).
- The start page search stays a full-width field (it fits at 360 px) instead of collapsing to an icon.
- Found by the desktop visual baselines: `box-content` on the headers made them 1 px taller on desktop; heights are now `calc(… + env(safe-area-inset-top))`, identical on desktop.

**Dependencies added:** none
**Verification:** pnpm verify ✅ (793 unit tests; new `touchGestures.test.ts`) · pnpm test:e2e ✅ (191 = desktop + mobile; new `mobile-layout.spec.ts` at 360 and 412 px: no sideways overflow on the start page, a board and the gallery, every action reachable and ≥ 44 px, toolbar below the canvas, title keeps room, the Insert menu holds the secondary tools / media / templates, Back to origin; `mobile-gestures.spec.ts`: one-finger pan selects nothing, drag on an element moves it, a pinch starting on an element zooms and moves nothing, long-press marquee, double-tap edits, tap clears) · desktop visual baselines unchanged · screenshots at 360 (light), 390 (dark), 412 (light) of the start page, a board and the Insert menu reviewed.
