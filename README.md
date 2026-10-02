# SMTHNG

A whiteboard that lives in your browser, with two add-ons:

- **Diagrams** — connect any object (shape, sticky note, text, image, drawing, frame, doc card) to any other with smart connectors.
- **Doc cards** — rich-text documents on the canvas, with a full-page focus mode.

There is no backend and no account.

## Features

- **Pages:** several pages per board, as sheet tabs along the bottom (add, rename, reorder, delete).
- **Sketching:** a sketch is one object you keep drawing into, with pen, pencil, marker, highlighter and an eraser; pen and pencil follow stylus pressure.
- **Whiteboard:** infinite canvas, shapes, sticky notes, text, pen, images, frames; select, move, resize, rotate, group, lock; undo and redo; copy and paste.
- **Styling:** contextual style popover, quick styles, align and distribute, smart guides, snap to grid.
- **Diagrams:** straight, elbow and curved connectors, seven end markers, labels, manual bends, a flowchart shape library, quick-create of connected shapes.
- **Doc cards:** headings, lists, checklists, quotes, code, links; focus mode; `/` commands; `@` mentions of canvas objects; Markdown export.
- **Sharing:** PNG and SVG export, `.smthng` board files, full backup and restore, templates.
- **Everywhere:** installable, works offline, light and dark themes, keyboard-only use, screen reader announcements. Press `?` on a board for the shortcut list.

## Data & privacy

Everything is stored **only in this browser** (IndexedDB). Nothing is sent to a server.

That also means your boards are gone if the browser's site data is cleared, and they don't follow you to another device. **Back up regularly:** Settings → "Backup all boards" downloads one `.smthng` file that you can import anywhere.

## Development

Requires Node 22+ and pnpm 10+.

```bash
pnpm install
pnpm dev            # http://localhost:5173
pnpm verify         # type check + lint + unit tests + production build
pnpm analyze        # bundle treemap in stats.html
pnpm icons          # regenerate the PWA icons from static/logo.svg
```

The app is built with SvelteKit (SPA mode), Svelte 5, TypeScript, Tailwind CSS v4, Yjs and TipTap. Architecture notes and the step-by-step build log are in [`plan/`](./plan/README.md); agent instructions are in [`CLAUDE.md`](./CLAUDE.md).

## Testing

```bash
pnpm test                 # unit and component tests (Vitest)
pnpm test:e2e             # end-to-end tests in Chromium (Playwright)
pnpm test:e2e:all         # Chromium, Firefox and WebKit
```

First run: `pnpm exec playwright install --with-deps chromium firefox webkit`. WebKit needs the system libraries of a supported distribution (Ubuntu or Debian); CI runs all three browsers.

The end-to-end tests run against the production build, served like a static host with the real security headers (`scripts/serve-build.mjs`).

**Visual regression.** `tests/e2e/visual.spec.ts` compares the canvas with stored screenshots (light and dark), using a fixture board that contains every element type:

```bash
pnpm fixtures                                  # regenerate tests/e2e/fixtures/visual-board.smthng
pnpm test:e2e visual --update-snapshots        # accept the current rendering as the baseline
```

Baselines depend on the machine's fonts, so they are compared locally (Chromium) and skipped on CI. After an intended visual change, delete `tests/e2e/visual.spec.ts-snapshots/` and update, then review the new images before committing.

## Deploy

The build is a static site in `build/`. It includes `_redirects` (single-page fallback) and `_headers` (Content-Security-Policy and caching), which Cloudflare Pages and Netlify read as-is.

**Cloudflare Pages (dashboard)**

1. Workers & Pages → Create → Pages → Connect to Git, and pick this repository.
2. Build command: `pnpm build` · Build output directory: `build`.
3. Environment variable: `NODE_VERSION` = `22`.
4. Save and deploy.

**Cloudflare Pages (CLI)**

```bash
pnpm build
pnpm dlx wrangler login                                   # once, opens the browser
pnpm dlx wrangler pages deploy build --project-name smthng
```

**Netlify:** the same settings (build command `pnpm build`, publish directory `build`, Node 22).

**Any other static host** works if it serves `index.html` for unknown paths and sends the headers from `build/_headers`. The `script-src` hash in that file is written by the build (`scripts/postbuild-csp.mjs`), so always deploy the `_headers` from the same build as the pages.

To check a build locally exactly as it will be served: `pnpm build && pnpm serve`.

## Roadmap

- Real-time collaboration: a sync server provider added where the board is opened (`openBoard`); the data model is already a Yjs document.
- Comments on objects and doc cards.
- Version history.
