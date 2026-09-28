# Step 15 — Pen, eraser, images

Phase: C. Canvas · Depends on: 14 · Estimate: 1.5 days

## Goal
Freehand drawing with pressure, an eraser, and images (upload, paste, drag-drop) stored as blobs in IndexedDB with asset garbage collection.

## Read first
- `00-architecture.md` §5 (StrokeElement, ImageElement), §6 (assets)
- `src/lib/storage/assetsRepo.ts`, `src/lib/board/commands/clipboard.ts`

## Tasks
1. Install: `pnpm add perfect-freehand`.
2. **Simplification** `src/lib/board/engine/simplify.ts`: `simplifyRDP(points: number[] /* flat x,y,p */, epsilon: number): number[]` (Ramer–Douglas–Peucker on x,y, keeping the pressure of kept points).
3. **Stroke rendering** `src/lib/board/elements/stroke/`:
   - `strokePath.ts`: `strokeOutline(points: number[], width: StrokeWidth, simulatePressure: boolean): number[][]` via `getStroke(pts, { size: SIZE[width], thinning: 0.5, smoothing: 0.5, streamline: 0.5, simulatePressure })` with `SIZE = {1: 3, 2: 5, 4: 9, 8: 16}`; `outlineToSvgPath(outline): string` (the standard quadratic-midpoint helper from the perfect-freehand README).
   - Store `simulatePressure` implicitly: if every pressure equals 0.5, simulate.
   - `StrokeView.svelte`: an `<svg overflow="visible">` with a filled path in `style.stroke` color, opacity from the style. The path is memoized with `$derived` on `points` + width.
   - `definition.ts`: `hitTest` = distance from `p` (converted to local coordinates, accounting for rotation) to the polyline ≤ `tol + SIZE/2`; `aabb` = the rotated box. `styleOptions` later: stroke, strokeWidth, opacity.
4. **Pen tool** `tools/pen.ts` (P):
   - pointerdown: start a local buffer `[x, y, pressure]` in world coordinates (`pressure` = `e.pressure || 0.5`; for mouse always 0.5).
   - pointermove: append (use `getCoalescedEvents()` when available) and render a **live preview** in the overlay (screen-space SVG using the same outline function, converted through the viewport) — no Yjs writes during the stroke.
   - pointerup: simplify (`epsilon = 0.5 / zoom`), compute the bbox, make points relative to the bbox origin, `createElements` with a `stroke` element (`w/h` = bbox size, minimum 1). One undo step.
   - The pen tool stays active after a stroke (it doesn't return to select).
5. **Eraser tool** `tools/eraser.ts` (E): while dragging, collect elements hit by the pointer path (`hitElement` along interpolated points every 4 screen px); show them at 30% opacity (local `erasing` set in context, read by `ElementView`); pointerup → `deleteElements` (skipping locked). Escape cancels. Draw a fading trail in the overlay.
6. **Images**
   - `src/lib/board/images/importImages.ts`: `importImageFiles(ctx, files: File[], at: Point): Promise<string[]>`:
     - Accept `image/png`, `image/jpeg`, `image/gif`, `image/webp`, `image/svg+xml`. Reject files over 20 MB (toast).
     - Get dimensions: `createImageBitmap` (for SVG, load into an `Image` from an object URL).
     - Downscale raster images (not GIF or SVG) whose longest side exceeds 2048 px using an `OffscreenCanvas`/canvas → `image/webp` 0.9 (fall back to png).
     - `assetsRepo.put(boardId, blob, dims)`.
     - Create an image element: natural size, scaled down to fit within 50% of the visible world rect, centered on `at`; multiple files cascade by +24/+24.
     - Select the new images; one undo step for the batch (`stopCapturing` before, create in one `transact`).
   - `src/lib/board/images/assetUrls.ts`: `AssetUrlCache` per board: `get(assetId): Promise<string | null>` (loads the blob and caches an object URL), `revokeAll()` on board close. Add it to `BoardContext`.
   - `elements/image/ImageView.svelte`: `<img draggable="false" alt="">` with `object-fit: fill` and the radius from the style; a loading skeleton; a missing asset → a gray box with an ImageOff icon.
   - `definition.ts`: `keepAspect: true`.
   - **Image tool:** the toolbar button and `Mod+Shift+I` open a hidden `<input type="file" accept="image/*" multiple>`; insert at the viewport center.
   - **Drag and drop** onto the canvas: `dragover` preventDefault + a highlight; `drop` → image files → `importImageFiles` at the drop point.
   - **Paste:** implement the `onPasteImages` hook from step 14.
7. **Asset GC** `src/lib/board/images/gcAssets.ts`: `gcAssets(boardId, doc)`: on board open (after `openBoard`, in the background), delete assets of this board not referenced by any image element. It's safe because the undo stack is empty at open.
8. Enable the Pen, Eraser and Image toolbar buttons.

## Files
- create: `src/lib/board/engine/simplify.ts`, `src/lib/board/elements/stroke/*`, `src/lib/board/elements/image/*`, `src/lib/board/tools/{pen.ts, eraser.ts}`, `src/lib/board/images/{importImages.ts, assetUrls.ts, gcAssets.ts}`, `tests/e2e/fixtures/sample.png` (a small generated PNG, for example 64×48)
- modify: `elements/index.ts`, `ElementView.svelte`, `clipboard.ts`, `Canvas.svelte`, `Toolbar.svelte`, `context.ts`, `BoardWorkspace.svelte`

## Tests
- `simplify.test.ts`: collinear points collapse; corners are kept; the pressure of kept points is preserved.
- `stroke/definition.test.ts`: hit on the line, miss away from it, with a rotated stroke.
- `gcAssets.test.ts`: an unreferenced asset is deleted and a referenced one is kept.
- `tests/e2e/pen-images.spec.ts`: P + a mouse drag path → one stroke element; reload → still there; E + drag across it → deleted. Upload `sample.png` via the file chooser → an image element with an `<img>` whose `naturalWidth > 0`; reload → the image still loads.

## Acceptance criteria
- [ ] `pnpm verify` and `pnpm test:e2e` pass
- [ ] Drawing is smooth with no lag at 3,000 elements (the preview doesn't touch Yjs)
- [ ] Pressure works with a pen or stylus where available (manual, optional)

## Out of scope
Stroke convex hull (later), image cropping or filters (never).

## Commit
`feat(canvas): add freehand pen, eraser and image elements with IndexedDB assets`
