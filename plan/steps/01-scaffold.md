# Step 01 — Scaffold the project

Phase: A. Foundation · Depends on: — · Estimate: 0.5 day

## Goal
A SvelteKit SPA skeleton with strict TypeScript, Tailwind v4, ESLint + Prettier, Vitest, Playwright, a `verify` script, CI, and a git repository.

## Read first
- `CLAUDE.md` (all)
- `00-architecture.md` §2 (stack), §4 (folder structure)

## Tasks
1. **Scaffold into a temp dir** (the repo root already contains `CLAUDE.md`, `AGENTS.md`, `plan/`, so `sv create` would refuse a non-empty dir):
   ```bash
   pnpm dlx sv create .scaffold --template minimal --types ts --no-add-ons --no-install
   ```
   If the flags differ in the current `sv` version, run `pnpm dlx sv create --help` and use the non-interactive equivalents. Move everything (including dotfiles) from `.scaffold/` to the repo root without overwriting `CLAUDE.md`, `AGENTS.md`, `plan/`. Delete `.scaffold/`.
2. In `package.json` set `"name": "smthng"`, `"private": true`, `"type": "module"`. Run `pnpm install`.
3. **SPA mode:** `pnpm remove @sveltejs/adapter-auto && pnpm add -D @sveltejs/adapter-static`. In `svelte.config.js`: `adapter: adapter({ fallback: 'index.html' })`. Create `src/routes/+layout.ts`:
   ```ts
   export const ssr = false;
   export const prerender = false;
   ```
4. **TypeScript:** in `tsconfig.json` keep `strict: true`, add `"noUncheckedIndexedAccess": true`, `"noImplicitOverride": true`.
5. **Tailwind v4:** `pnpm add -D tailwindcss @tailwindcss/vite`. Add `tailwindcss()` to `vite.config.ts` plugins **before** `sveltekit()`. Create `src/app.css` with `@import "tailwindcss";`. Create `src/routes/+layout.svelte` that imports `../app.css` and renders `{@render children()}` (Svelte 5 syntax).
6. **ESLint + Prettier:** try `pnpm dlx sv add eslint prettier`; if it prompts or fails, install manually: `eslint @eslint/js typescript-eslint eslint-plugin-svelte eslint-config-prettier globals prettier prettier-plugin-svelte prettier-plugin-tailwindcss`. Flat config `eslint.config.js`. Add rules: `@typescript-eslint/no-explicit-any: 'error'`, `@typescript-eslint/no-unused-vars: ['error', { argsIgnorePattern: '^_' }]`. Prettier: `singleQuote: true`, `printWidth: 100`, plugins svelte + tailwind. Create `.prettierignore` (build, .svelte-kit, pnpm-lock.yaml, plan).
7. **Vitest:** `pnpm add -D vitest jsdom fake-indexeddb @testing-library/svelte @testing-library/jest-dom`. In `vite.config.ts`:
   ```ts
   test: {
     environment: 'jsdom',
     include: ['src/**/*.{test,spec}.{ts,js}'],
     setupFiles: ['./vitest.setup.ts'],
   },
   resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
   ```
   (use `/// <reference types="vitest/config" />` or `defineConfig` from `vitest/config` so types check). `vitest.setup.ts`:
   ```ts
   import 'fake-indexeddb/auto';
   import '@testing-library/jest-dom/vitest';
   ```
   Add `src/lib/shared/sanity.test.ts` (1 trivial test) so the suite is non-empty.
8. **Playwright:** `pnpm add -D @playwright/test && pnpm exec playwright install chromium`. `playwright.config.ts`: `testDir: 'tests/e2e'`, `webServer: { command: 'pnpm build && pnpm preview --port 4173', port: 4173, reuseExistingServer: !process.env.CI }`, `use: { baseURL: 'http://localhost:4173' }`, one project `chromium`. Add `tests/e2e/smoke.spec.ts`: home page loads and shows text "SMTHNG". Make `src/routes/+page.svelte` render `<h1>SMTHNG</h1>`.
9. **Scripts** in `package.json`:
   ```json
   "dev": "vite dev",
   "build": "vite build",
   "preview": "vite preview",
   "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
   "lint": "prettier --check . && eslint .",
   "format": "prettier --write .",
   "test": "vitest run",
   "test:watch": "vitest",
   "test:e2e": "playwright test",
   "verify": "pnpm check && pnpm lint && pnpm test && pnpm build"
   ```
10. **.gitignore:** `node_modules`, `build`, `.svelte-kit`, `.scaffold`, `test-results`, `playwright-report`, `blob-report`, `.env*`, `stats.html`.
11. **CI** `.github/workflows/ci.yml`: on push + pull_request; ubuntu-latest; `pnpm/action-setup@v4`; `actions/setup-node@v4` with Node 22 and pnpm cache; `pnpm install --frozen-lockfile`; `pnpm verify`.
12. Create `README.md` (short: what SMTHNG is, `pnpm dev`, `pnpm verify`, link to `plan/README.md`).
13. `git init -b main`, then commit (see below).

## Files
- create: `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `.prettierrc`, `.prettierignore`, `.gitignore`, `vitest.setup.ts`, `playwright.config.ts`, `src/app.html`, `src/app.css`, `src/app.d.ts`, `src/routes/+layout.ts`, `src/routes/+layout.svelte`, `src/routes/+page.svelte`, `src/lib/shared/sanity.test.ts`, `tests/e2e/smoke.spec.ts`, `.github/workflows/ci.yml`, `README.md`

## Tests
- `sanity.test.ts` (trivial)
- `smoke.spec.ts` (home shows "SMTHNG")

## Acceptance criteria
- [x] `pnpm verify` passes
- [x] `pnpm test:e2e` passes
- [x] `pnpm build` produces `build/index.html`
- [x] `pnpm dev` serves the page at http://localhost:5173
- [x] No `export let`, `on:` directives or `<slot>` anywhere in `src/`
- [x] Git repo initialized on `main` with one commit

## Out of scope
Routing beyond `/`, theming, any app features.

## Commit
`chore: scaffold SvelteKit SPA with TypeScript, Tailwind, Vitest, Playwright and CI`
