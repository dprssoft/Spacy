# Step 26 — Static SVG renderer, PNG/SVG export, thumbnails

Phase: G. Sharing · Depends on: 22, 25 · Estimate: 2 days

## Goal
A pure static SVG renderer (no `foreignObject`) used for SVG/PNG export of the board, a selection or a frame, and for start-page thumbnails.

## Read first
- `00-architecture.md` §12 (font family, sizes, line height)
- `src/lib/board/elements/*/` (paths, stroke outline), `src/lib/board/diagram/{geometry.ts, markers.ts, routing/*}`

## Tasks
1. **Text wrapping** `src/lib/board/render/wrapText.ts`: `wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[]`. It respects explicit newlines, breaks on spaces, and hard-breaks words longer than `maxWidth`. `createCanvasMeasurer(font: string)` uses an `OffscreenCanvas` / canvas 2D `measureText`, with a fallback of `chars × size × 0.55` when no canvas is available (jsdom tests).
2. **Renderer** `src/lib/board/render/staticSvg.ts` (no Svelte, no DOM except the injected measurer):
   ```ts
   export interface StaticRenderOptions {
     elements: Element[];                       // already filtered and sorted (frames first, then z)
     lookup: (id: string) => Element | undefined;
     bounds?: Rect;                             // default: union of AABBs
     padding?: number;                          // default 32
     background: 'transparent' | string;        // a color
     measure: (text: string, font: FontSpec) => number;
     assetDataUrl: (assetId: string) => Promise<string | null>;
     docLines: (doccardId: string) => Promise<{ text: string; kind: 'h' | 'p' | 'li' }[]>;
   }
   export async function renderStaticSvg(o: StaticRenderOptions): Promise<{ svg: string; width: number; height: number }>
   ```
   - Root `<svg xmlns viewBox width height>`, a `<rect>` background unless transparent, and `<defs>` for the shadow filter and markers.
   - Per type, each wrapped in `<g transform="translate(x y) rotate(deg cx cy)" opacity>`:
     - shape: `<path d=shapePath(...)>` + wrapped `<text>` lines (`<tspan x dy>`) aligned per `font.align/valign`
     - sticky: a rect with the sticky color + shadow filter + text
     - text: text lines
     - image: `<image href=dataURL width height preserveAspectRatio="none">` (+ the border if stroked)
     - stroke: the filled path from `strokeOutline` (points scaled as stored)
     - frame: a rect + a title `<text>` above
     - doccard: the card rect + a bold title + up to N body lines (from `docLines`, clipped with a `<clipPath>` to the card body; `h`-kind lines bold)
     - connector: the route path (from the shared `connectorGeometry`) + markers (reuse `markerPath`) + a label (with a background rect if enabled)
   - Escape all text for XML (`& < > " '`). `font-family` = `FONT_FAMILY`.
   - Output must be a standalone valid SVG (no external references).
3. **Plain text lines for doc cards** `src/lib/board/doccards/docLines.ts`: walk `getDocJSON` output into lines (headings `h`, list items prefixed with `•`, `☐`/`☑` for tasks, paragraphs `p`).
4. **Export** `src/lib/board/render/exportImage.ts`:
   - `exportSvg(ctx, scope)`, which returns a Blob of `image/svg+xml`.
   - `exportPng(ctx, scope, scale: 1 | 2 | 3)`: SVG → Blob URL → `Image` → canvas (`width*scale`, capped at 16,384 px per side; reduce the scale and toast if it's too large) → `toBlob('image/png')`.
   - `scope`: `{ kind: 'board' } | { kind: 'selection' } | { kind: 'frame'; id }`. A frame scope includes the frame and its children plus connectors whose both ends are inside. A selection scope includes connectors between selected elements.
   - Asset data URLs from `assetsRepo` blobs (FileReader) with a per-export cache.
5. **Export dialog** `src/lib/board/ui/ExportDialog.svelte` (bits-ui Dialog): format (PNG/SVG), scope (Board / Selection (disabled if empty) / Frame: a select), scale (PNG only), background (Transparent / White). A live preview thumbnail (the SVG as an `<img>`). The Download button uses `downloadBlob` with `slug(title)` + the scope suffix. Wire the TopBar Export menu items "PNG…" and "SVG…" (both open the dialog preset to that format) and a context menu item "Export selection…".
6. **Thumbnails** `src/lib/board/render/thumbnails.ts`: `renderThumbnail(ctx): Promise<Blob>`: the whole board fitted into 480×300 (center, `preserveAspectRatio="xMidYMid meet"`, padding 24), background `#f7f7f8`; an empty board → the plain background. `image/webp` quality 0.8 (fall back to png).
   - Trigger: debounced 10 s after the last `LOCAL` update, on `visibilitychange → hidden`, and on board close (fire and forget before `close()` resolves; don't block navigation for more than 300 ms).
   - Save via `boardsRepo.setThumbnail`. `BoardCard` already displays it.

## Files
- create: `src/lib/board/render/{wrapText.ts, staticSvg.ts, exportImage.ts, thumbnails.ts}`, `src/lib/board/doccards/docLines.ts`, `src/lib/board/ui/ExportDialog.svelte`
- modify: `TopBar.svelte`, `CanvasContextMenu.svelte`, `BoardPage.svelte` / `BoardWorkspace.svelte` (thumbnail triggers)

## Tests
- `wrapText.test.ts`: newlines, wrapping, long words, empty text.
- `staticSvg.test.ts`: render a fixture containing **every** element type (use `elements/fixtures.ts`), then parse with `new DOMParser().parseFromString(svg, 'image/svg+xml')` → no `parsererror`; no `foreignObject`; contains the expected number of top-level `<g>`; text is XML-escaped (a fixture with `<&>`); a small fixed fixture snapshot (`toMatchSnapshot`).
- `tests/e2e/export.spec.ts`: create a few elements → Export → PNG → a download event with size > 1 KB; SVG download contains `<svg`; after leaving the board, the home card shows an `<img>` thumbnail within 2 s.

## Acceptance criteria
- [ ] `pnpm verify` and `pnpm test:e2e` pass
- [ ] Exported PNGs look like the canvas: positions, colors, text wrapping, markers (manual comparison noted in PROGRESS)
- [ ] Export works in Chrome and Firefox (manual)

## Out of scope
PDF export, exporting the dark theme.

## Commit
`feat(export): add static SVG renderer, PNG/SVG export dialog and board thumbnails`
