# Step 32 — Full E2E coverage and deployment

Phase: H. Release · Depends on: 31 · Estimate: 1.5 days

## Goal
Cross-browser E2E coverage of all major flows, visual regression baselines, security headers, a production deployment configuration, and the v1.0.0 release. **Milestone M7.**

## Read first
- All `tests/e2e/*.spec.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`

## Tasks
1. **Coverage audit.** Make sure these suites exist and are green (add or extend as needed):
   | Suite | Covers |
   |---|---|
   | `home.spec.ts` | create, rename, star, duplicate, trash/restore/delete, search, sort, layout |
   | `board-shell.spec.ts` | title sync, not found, trashed state |
   | `create.spec.ts`, `select.spec.ts`, `commands.spec.ts` | creation tools, transforms, undo, clipboard, z-order, group, lock |
   | `pen-images.spec.ts`, `frames.spec.ts` | pen, eraser, images, frames |
   | `style.spec.ts`, `arrange.spec.ts` | popover, quick styles, align, snapping |
   | `connect.spec.ts`, `routing.spec.ts`, `diagram.spec.ts` | connectors to every type, routing, markers, labels, bends, quick-create |
   | `doccard.spec.ts`, `focus-mentions.spec.ts`, `markdown.spec.ts` | doc cards end to end |
   | `export.spec.ts`, `files.spec.ts`, `templates.spec.ts` | sharing |
   | `tabs-sync.spec.ts` | two pages on the same board: create, move and type in one → visible in the other |
   | `offline.spec.ts`, `settings.spec.ts`, `a11y.spec.ts`, `keyboard-only.spec.ts`, `perf-guard.spec.ts` | release quality |
2. **Browsers:** add Playwright projects `firefox` and `webkit`. Tag Chromium-only tests (`offline`, `perf-guard`, visual snapshots, File System Access) with `test.skip(browserName !== 'chromium', reason)`. Fix any real cross-browser bugs found. Record WebKit quirks in PROGRESS.
3. **Visual regression:** `visual.spec.ts` imports a fixture `.spacy` file (commit `tests/e2e/fixtures/visual-board.spacy`, generated from a script `pnpm fixtures`, not by hand) that contains every element type, all routing types and markers → `toHaveScreenshot` at 100% zoom in light and dark themes (Chromium only). Document updating baselines (`pnpm test:e2e --update-snapshots`) in `README.md`.
4. **CI:** a matrix over the browsers for the e2e job (cache Playwright browsers keyed by version; `--with-deps`), upload the HTML report and traces on failure, `retries: 2` on CI only, `workers: 2`.
5. **Static hosting config:**
   - `static/_redirects`: `/*  /index.html  200` (Netlify and Cloudflare Pages SPA fallback).
   - `static/_headers`:
     ```
     /*
       X-Content-Type-Options: nosniff
       Referrer-Policy: strict-origin-when-cross-origin
       Permissions-Policy: camera=(), microphone=(), geolocation=()
       Content-Security-Policy: default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; worker-src 'self'; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
     /_app/immutable/*
       Cache-Control: public, max-age=31536000, immutable
     ```
   - The inline theme script (step 02) and SvelteKit's inline bootstrap script conflict with `script-src 'self'`. Try `kit.csp = { mode: 'hash', directives: {...} }` in `svelte.config.js` and move the theme script to `static/theme-init.js` (loaded synchronously in `<head>`). Verify the built `build/index.html` boots under this CSP (serve `build/` with the headers, for example `npx serve` with a config or a tiny local script, and check the console for CSP errors). If the fallback page can't be hashed, use `'unsafe-inline'` for `script-src` and record why in PROGRESS.
6. **Deploy:**
   - Cloudflare Pages (preferred) settings: build command `pnpm build`, output directory `build`, Node 22. Or Netlify with the same settings (`netlify.toml` optional).
   - If deploy credentials are available in the environment (for example `CLOUDFLARE_API_TOKEN`), deploy with `pnpm dlx wrangler pages deploy build --project-name spacy`. **Otherwise do not attempt to log in:** write the exact manual steps into `README.md` → "Deploy", and stop.
7. **Release:** `package.json` version `1.0.0`; `CHANGELOG.md` (v1.0.0: a feature summary by milestone); `README.md` sections: What it is · Features · Data & privacy (stored only in your browser; back up) · Development · Testing · Deploy · Roadmap (real-time collaboration via a sync server in `openBoard`, comments, version history). Tag `v1.0.0` (`git tag -a v1.0.0 -m "Spacy 1.0.0"`). Don't push unless the human asks.

## Files
- create: `static/_redirects`, `static/_headers`, `static/theme-init.js`, `tests/e2e/{visual.spec.ts, tabs-sync.spec.ts}`, `tests/e2e/fixtures/visual-board.spacy`, `scripts/make-fixtures.ts`, `CHANGELOG.md`
- modify: `playwright.config.ts`, `.github/workflows/ci.yml`, `svelte.config.js`, `src/app.html`, `README.md`, `package.json`

## Tests
All the suites above; the full matrix is green locally for Chromium, and in CI for all browsers.

## Acceptance criteria
- [ ] `pnpm verify` passes; `pnpm test:e2e` passes in Chromium, Firefox and WebKit
- [ ] The built app runs under the CSP with no console errors
- [ ] Lighthouse (home, production build): Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95 (record it in PROGRESS)
- [ ] Deployed URL works, or the manual deploy steps are documented
- [ ] `v1.0.0` tagged
- [ ] **M7:** release

## Out of scope
Real-time collaboration, accounts (future roadmap).

## Commit
`chore(release): cross-browser e2e, security headers, deploy config and v1.0.0`
