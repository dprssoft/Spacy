# SMTHNG

A browser-only whiteboard with two add-ons: **diagrams** (connect any object to any object) and **doc cards** (rich-text documents on the canvas). There's no backend: boards are stored in your browser (IndexedDB).

Built with SvelteKit (SPA mode), Svelte 5, TypeScript, Tailwind CSS v4 and Yjs.

## Development

Requires Node 22+ and pnpm 10+.

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm verify       # type check + lint + unit tests + build
pnpm test:e2e     # Playwright end-to-end tests (first run: pnpm exec playwright install chromium)
```

## Plan

Development follows a step-by-step plan in [`plan/README.md`](./plan/README.md). Agent instructions are in [`CLAUDE.md`](./CLAUDE.md).
