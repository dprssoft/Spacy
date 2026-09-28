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
