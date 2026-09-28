# Step 02 — App shell, routing, theme

Phase: A. Foundation · Depends on: 01 · Estimate: 0.5 day

## Goal
Routes for the start page and board page, an error page, theme tokens with light/dark/system modes that persist without a flash, and shared UI dependencies installed.

## Read first
- `00-architecture.md` §4, §6 (localStorage keys)
- `CLAUDE.md` Svelte 5 rules

## Tasks
1. Install: `pnpm add bits-ui @lucide/svelte`.
2. **Routes**
   - `src/routes/+page.svelte`: placeholder heading "SMTHNG" and "Your boards" subtitle. (Replaced in step 06.)
   - `src/routes/board/[id]/+page.svelte`: placeholder showing `Board {page.params.id}` (use `import { page } from '$app/state'`) and a link back to `/`.
   - `src/routes/+error.svelte`: shows `page.status` and `page.error?.message`, plus a "Back to boards" link to `/`.
3. **localPrefs** `src/lib/shared/localPrefs.ts`:
   ```ts
   export function getPref<T>(key: string, fallback: T): T;   // JSON.parse, try/catch → fallback
   export function setPref<T>(key: string, value: T): void;    // JSON.stringify, try/catch (ignore errors)
   export function removePref(key: string): void;
   ```
   Keys are passed without the prefix. The helper adds `smthng:`.
4. **Theme tokens** in `src/app.css`:
   - `:root` (light) and `[data-theme='dark']` define: `--bg`, `--surface`, `--surface-2`, `--border`, `--text`, `--text-muted`, `--accent`, `--accent-contrast`, `--danger`, `--canvas-bg`, `--canvas-dot`, `--selection`, `--shadow`.
   - Light: bg `#f7f7f8`, surface `#ffffff`, surface-2 `#f1f1f3`, border `#e3e3e8`, text `#1e1e1e`, text-muted `#6b6b76`, accent `#4f46e5`, accent-contrast `#ffffff`, danger `#e03131`, canvas-bg `#fafafa`, canvas-dot `#d4d4d8`, selection `#4f46e5`.
   - Dark: bg `#111113`, surface `#1b1b1f`, surface-2 `#232329`, border `#2e2e35`, text `#ececf1`, text-muted `#9a9aa5`, accent `#818cf8`, accent-contrast `#111113`, danger `#ff6b6b`, canvas-bg `#141417`, canvas-dot `#34343c`, selection `#818cf8`.
   - Expose them to Tailwind: `@theme inline { --color-bg: var(--bg); --color-surface: var(--surface); ... }` so classes like `bg-surface`, `text-muted`, `border-border` work.
   - Dark variant: `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));`
   - `--font-sans` set to the font stack from `00-architecture.md` §12. `body { background: var(--bg); color: var(--text); }`.
5. **No-flash init:** in `src/app.html` `<head>`, add a small inline script that reads `localStorage['smthng:theme']` (JSON string `"light"|"dark"|"system"`, default system), resolves system via `matchMedia('(prefers-color-scheme: dark)')`, and sets `document.documentElement.dataset.theme`. Wrap it in try/catch.
6. **Theme state** `src/lib/shared/theme.svelte.ts`:
   ```ts
   export type ThemeMode = 'light' | 'dark' | 'system';
   class ThemeState {
     mode = $state<ThemeMode>(getPref('theme', 'system'));
     systemDark = $state(false);
     resolved = $derived(this.mode === 'system' ? (this.systemDark ? 'dark' : 'light') : this.mode);
     init(): () => void   // matchMedia listener + $effect.root applying data-theme; returns cleanup
     set(mode: ThemeMode): void  // persists via setPref
   }
   export const theme = new ThemeState();
   ```
   Call `theme.init()` from `+layout.svelte` (in an `$effect` with cleanup).
7. **ThemeToggle** `src/lib/shared/ui/ThemeToggle.svelte`: an icon button that cycles light → dark → system (icons Sun / Moon / Monitor) with `aria-label="Theme: <mode>"` and a bits-ui Tooltip.
8. Put `ThemeToggle` in the placeholder home page header.

## Files
- create: `src/routes/board/[id]/+page.svelte`, `src/routes/+error.svelte`, `src/lib/shared/localPrefs.ts`, `src/lib/shared/theme.svelte.ts`, `src/lib/shared/ui/ThemeToggle.svelte`
- modify: `src/app.css`, `src/app.html`, `src/routes/+layout.svelte`, `src/routes/+page.svelte`

## Tests
- `src/lib/shared/localPrefs.test.ts`: round-trips values, returns the fallback on invalid JSON, doesn't throw when `localStorage.setItem` throws (mock it).
- `tests/e2e/theme.spec.ts`: click the toggle until dark, reload, and `html[data-theme="dark"]` is still set.
- `tests/e2e/routing.spec.ts`: `/board/abc` shows "abc"; `/does-not-exist` shows the error page with a link home.

## Acceptance criteria
- [x] `pnpm verify` and `pnpm test:e2e` pass
- [x] Theme persists across reloads with no flash of the wrong theme
- [x] System mode follows the OS setting live
- [x] Tailwind classes `bg-surface`, `text-muted`, `border-border` work in both themes

## Out of scope
Start page UI (step 06), board UI (step 08).

## Commit
`feat(shell): add routes, error page, theme tokens and theme toggle`
