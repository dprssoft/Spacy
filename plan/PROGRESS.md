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
