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
