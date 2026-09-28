# SMTHNG — agent guide

SMTHNG is a browser-only whiteboard web app with two add-ons:

- **Diagrams** — any object (shape, sticky, text, image, freehand stroke, frame, doc card) can be connected with smart connectors; basic diagram styling.
- **Doc cards** — rich-text documents living on the canvas, with a full-page focus mode.

There is **no backend**. Everything is stored in the browser (IndexedDB). The start page lists recent boards (Figma-like) with a "New board" button.

Stack: SvelteKit (SPA mode, adapter-static) · Svelte 5 (runes) · TypeScript (strict) · Tailwind CSS v4 · Yjs · TipTap · bits-ui · Vitest · Playwright · pnpm.

## Where things are

| Path                      | What                                                                       |
| ------------------------- | -------------------------------------------------------------------------- |
| `plan/README.md`          | Step checklist — **source of truth for progress**                          |
| `plan/00-architecture.md` | Architecture, data model, interfaces, conventions. Read before every step. |
| `plan/steps/NN-*.md`      | One file per implementation step                                           |
| `plan/PROGRESS.md`        | Log of completed steps, decisions, deviations                              |

## How to execute a step

1. Open `plan/README.md`. Pick the first unchecked step (unless the human named one). Make sure every step in its "Depends on" is checked.
2. Read the relevant sections of `plan/00-architecture.md` and the whole step file.
3. Read `plan/PROGRESS.md` for deviations made in earlier steps.
4. Implement the step's **Tasks**. Stay in scope: anything under "Out of scope" belongs to a later step — do not build it early.
5. Write the tests the step asks for.
6. Run `pnpm verify`. If the step has e2e criteria, also run `pnpm test:e2e`. Fix until green. Never weaken or delete an existing test to get green — fix the code, or record why the test was wrong.
7. Tick each acceptance checkbox in the step file that you actually verified. Tick the step in `plan/README.md`.
8. Append an entry to `plan/PROGRESS.md` (template inside that file).
9. Commit: `git add -A && git commit -m "<commit message from the step file>"`.
10. Stop and report what was done. **One step per run** unless the human says otherwise.

### When something doesn't match the plan

- A library API differs from what the step describes (versions move): use the library's current documented API, keep the step's intent, record it under "Deviations" in `PROGRESS.md`.
- A requirement is ambiguous: choose the simplest option consistent with `00-architecture.md` and record it.
- A change would alter the **data model, storage format, or a public interface** in `00-architecture.md`: stop and ask the human. If approved, update `00-architecture.md` in the same commit.
- Adding a dependency not named in the plan: allowed only if small and justified; record it in `PROGRESS.md`.

## Commands

```bash
pnpm dev            # dev server (http://localhost:5173)
pnpm check          # svelte-check + TypeScript
pnpm lint           # prettier --check + eslint
pnpm format         # prettier --write
pnpm test           # vitest run (unit + component)
pnpm test:watch     # vitest watch
pnpm test:e2e       # playwright (builds + previews the app)
pnpm build          # production build into ./build
pnpm verify         # check + lint + test + build — must pass before every commit
```

## Svelte 5 rules (strict — do not use Svelte 4 syntax)

- Props: `let { a, b = 1 }: Props = $props();` — never `export let`.
- State: `$state`, `$derived`, `$derived.by`, `$effect`. Never `$:` reactive statements.
- Events: `onclick={...}` attributes — never `on:click`. Component events are callback props (`onchange`), never `createEventDispatcher`.
- Content: snippets and `{@render children?.()}` — never `<slot>`.
- Shared reactive state lives in classes in `*.svelte.ts` files using `$state` fields. Do **not** use `svelte/store` (`writable`, `readable`) except where a library requires it.
- Reactive collections: `SvelteMap` / `SvelteSet` from `svelte/reactivity`.
- Page state: `import { page } from '$app/state'` — never `$app/stores`.
- Mount components imperatively (TipTap popups) with `mount()` / `unmount()` from `svelte`.
- `$effect` is for side effects that touch the outside world (DOM, listeners, Yjs subscriptions) and must return cleanup when it subscribes. Don't use it to derive state — use `$derived`.
- Actions → prefer `{@attach ...}` attachments if available in the installed Svelte version, otherwise `use:action`.

## Code rules

- **TypeScript strict**, `noUncheckedIndexedAccess`. No `any` (use `unknown` + narrowing). No `@ts-ignore` without a comment explaining why.
- **Pure core, thin UI.** `src/lib/model`, `src/lib/storage`, `src/lib/board/engine`, `src/lib/board/diagram` (geometry/routing), `src/lib/board/render` must not import `.svelte` files. Put math and logic there and unit-test it.
- **All Y.Doc writes go through helper functions** in `src/lib/model/ops.ts` (or `src/lib/board/diagram/ops.ts`), each inside `doc.transact(fn, origin)`. Components never call `ymap.set` directly.
- Transaction origins come from `src/lib/model/origins.ts`. Local user edits use `LOCAL`. The undo manager tracks only `LOCAL`.
- Pointer-driven writes (drag, resize, draw) are batched to at most one Yjs transaction per animation frame, and each gesture is one undo step (`undo.stopCapturing()` at gesture start).
- Hit-testing is done in TypeScript via the spatial index + geometry, **not** via DOM event targets. Element wrappers have `pointer-events: none` unless they are in text/doc editing mode.
- Styling: Tailwind utility classes for UI chrome; theme colors via CSS variables (`--bg`, `--surface`, ...) exposed as Tailwind colors. Canvas element appearance comes from element data (inline style / SVG attributes).
- `localStorage` access only via `src/lib/shared/localPrefs.ts` (wrapped in try/catch). Keys are prefixed `smthng:`.
- Files: `PascalCase.svelte` for components, `camelCase.ts` for modules, `*.svelte.ts` for rune-based state, tests next to code as `*.test.ts`. E2E tests in `tests/e2e/*.spec.ts`.
- Keep components small (< ~250 lines). Extract logic into `.ts` modules.
- User-facing text in English, sentence case ("New board", not "New Board").
- No comments that restate code. Comment _why_, not _what_.
