# Spacy

A whiteboard that lives in your browser, with two add-ons:

- **Diagrams** — connect any object (shape, sticky note, text, image, drawing, frame, doc card) to any other with smart connectors.
- **Doc cards** — rich-text documents on the canvas, with a full-page focus mode.

There is no backend and no account.

## Features

- **Pages:** several pages per board, as sheet tabs along the bottom (add, rename, reorder, duplicate, delete).
- **Sketching:** a sketch is one object you keep drawing into, with pen, pencil, marker, highlighter and an eraser; pen and pencil follow stylus pressure.
- **Whiteboard:** infinite canvas, shapes, sticky notes, text, pen, images, frames; select, move, resize, rotate, group, lock; undo and redo; copy and paste.
- **Styling:** contextual style popover with a 50-color palette, any custom color and recent colors, 13 fonts (10 bundled, with Cyrillic) for all text, quick styles, align and distribute, smart guides, snap to grid.
- **Diagrams:** straight, elbow and curved connectors, seven end markers, labels, manual bends, a flowchart shape library, quick-create of connected shapes.
- **Doc cards:** headings, lists, checklists, quotes, code, links; fonts, sizes, colors, highlights and alignment from a Word-like ribbon; focus mode; `/` commands; `@` mentions of canvas objects; Markdown export.
- **Writing:** word counts, an outline in manuscript order, compile to Markdown, Word or print, backlinks, find and replace, comments on objects and text.
- **Media:** YouTube, Vimeo, audio and video links play in place, with clips, loop and speed.
- **Presenting:** waystones (named checkpoints to fly between) and full screen.
- **Sharing:** PNG and SVG export, `.spacy` board files, full backup and restore, a template gallery (start a board or insert into one).
- **Everywhere:** installable, works offline, phones and tablets, light and dark themes with six palettes, keyboard-only use, screen reader announcements. Press `?` on a board for the shortcut list.

## Data & privacy

Everything is stored **in this browser** (IndexedDB). Nothing is sent to a server, unless you turn on one of these:

**Google Drive sync** (Settings → "Sync with Google Drive…", when the app is built with a Google client id): boards, the board list and images are also kept in a hidden app folder of **your own** Google Drive, which only Spacy can see, so your other devices get them. See `/privacy`.

**Live sharing** (Share on a board): edits go directly between the browsers that have the board open, encrypted. Public Nostr relays only introduce the browsers to each other (they see a scrambled room name, never the board or the link's key). Each person keeps their own copy. Some strict networks block direct connections; there's no fallback for those.

That also means your boards are gone if the browser's site data is cleared, and they don't follow you to another device. **Back up regularly:** Settings → "Backup all boards" downloads one `.spacy` file that you can import anywhere.

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
pnpm test:e2e             # end-to-end tests in Chromium and phone emulation (Playwright)
pnpm test:e2e:all         # also Firefox and WebKit
```

First run: `pnpm exec playwright install --with-deps chromium firefox webkit`. WebKit needs the system libraries of a supported distribution (Ubuntu or Debian); CI runs all three browsers.

The end-to-end tests run against the production build, served like a static host with the real security headers (`scripts/serve-build.mjs`).

**Visual regression.** `tests/e2e/visual.spec.ts` compares the canvas with stored screenshots (light and dark), using a fixture board that contains every element type:

```bash
pnpm fixtures                                  # regenerate tests/e2e/fixtures/visual-board.spacy
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
pnpm dlx wrangler pages deploy build --project-name spacy
```

**Netlify:** the same settings (build command `pnpm build`, publish directory `build`, Node 22).

**Any other static host** works if it serves `200.html` for unknown paths (the rewrite in `build/_redirects`; `index.html` is the prerendered start page, not the fallback) and sends the headers from `build/_headers`. The `script-src` hash in that file is written by the build (`scripts/postbuild-csp.mjs`), so always deploy the `_headers` from the same build as the pages.

To check a build locally exactly as it will be served: `pnpm build && pnpm serve`.

**Google Drive sync** needs a Google OAuth client (the steps are in `plan/steps/50-google-drive.md`, "Human setup": a Google Cloud project with the Drive API, the consent screen with the `drive.appdata` scope and the privacy page `/privacy`, and a Web client whose JavaScript origins include your domain). Set `PUBLIC_GOOGLE_CLIENT_ID` for the build; the build adds Google's sign-in and API to the CSP. Without it, sync is hidden.

**Live sharing** needs nothing to deploy: browsers find each other through public Nostr relays ([Trystero](https://github.com/dmotz/trystero)), so the CSP allows `wss:` connections. To use only your own relay instead (tests, a private network): `pnpm relay` and `PUBLIC_LIVE_RELAY_URLS=ws://localhost:4444`. The computer's clock must be right within a few minutes: Nostr relays reject messages from the future, and the Share popover warns when the clock is off (on a hosted site; on `localhost` the server shares the wrong clock).

## Fonts

The bundled fonts come from [Fontsource](https://fontsource.org): Inter, Montserrat, Oswald, Comfortaa, Lora, Playfair Display, JetBrains Mono, Caveat and Pacifico under the SIL Open Font License 1.1, and Roboto Slab under the Apache License 2.0. Their licence texts ship in the `@fontsource*` packages.

## Roadmap

- Real-time collaboration: a sync server provider added where the board is opened (`openBoard`); the data model is already a Yjs document.
- Version history.
