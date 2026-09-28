# Step 09 — Viewport: pan and zoom

Phase: C. Canvas · Depends on: 08 · Estimate: 1.5 days

## Goal
An infinite canvas with smooth pan and zoom (mouse, trackpad, keyboard, touch pinch), a dot grid, zoom controls, and the viewport saved per board.

## Read first
- `00-architecture.md` §8 (coordinates, layers), §12 (zoom range and steps)

## Tasks
1. **Pure math** `src/lib/board/engine/viewport.ts` (no Svelte):
   ```ts
   export type Viewport = { x: number; y: number; zoom: number };
   screenToWorld(vp, p: Point): Point      // (p - vp.xy) / zoom
   worldToScreen(vp, p: Point): Point
   clampZoom(z: number): number            // ZOOM_MIN..ZOOM_MAX
   zoomAt(vp, screenPoint: Point, newZoom: number): Viewport   // keeps screenPoint fixed
   panBy(vp, dx: number, dy: number): Viewport
   visibleWorldRect(vp, size: { w: number; h: number }): Rect
   fitRect(rect: Rect, size, padding = 64, maxZoom = 1): Viewport
   nextZoomStep(zoom, dir: 1 | -1): number // from ZOOM_STEPS
   ```
   Also `src/lib/board/engine/geometry.ts` with `Rect` helpers needed here (`expandRect`, `rectsIntersect`, `unionRects`, `rectCenter`). Step 10 extends it.
2. **Reactive state** `src/lib/board/viewport.svelte.ts`:
   ```ts
   export class ViewportState {
     x = $state(0); y = $state(0); zoom = $state(1);
     size = $state({ w: 0, h: 0 });
     get vp(): Viewport
     set(vp: Viewport): void
     zoomAt(p, z), zoomBy(factor, around?), panBy(dx, dy), fit(rect | null), reset100()
     animateTo(target: Viewport, ms = 250): void   // rAF ease-out; instant if prefers-reduced-motion
   }
   ```
   Add `viewport` to `BoardContext`.
3. **Canvas** `src/lib/board/canvas/Canvas.svelte` (replaces the `<main>` placeholder content):
   - A container `div.relative.h-full.w-full.overflow-hidden.touch-none.select-none` with `tabindex="0"` and `role="application"` `aria-label="Board canvas"`.
   - A `ResizeObserver` updating `viewport.size`. On the first size: restore `BoardMeta.viewport`, or center the world origin (`x = w/2, y = h/2, zoom = 1`).
   - A world layer `div.absolute.left-0.top-0` with `style:transform="translate({x}px, {y}px) scale({zoom})"`, `transform-origin: 0 0`, `will-change: transform`. Children go through a snippet prop (layers added in step 10).
   - An overlay layer `div.absolute.inset-0.pointer-events-none` (screen space; used from step 11).
4. **Grid background** on the container: `background-image: radial-gradient(var(--canvas-dot) 1px, transparent 1px)`; `background-size = GRID_SIZE*zoom px`, `background-position = x px y px`. When `GRID_SIZE*zoom < 8`, use `GRID_SIZE*4*zoom` (coarser grid). Toggle with `localPrefs` `grid` (default on). The UI toggle comes in step 18. For now just respect the pref.
5. **Input** `src/lib/board/canvas/viewportInput.ts` (an attachment or action taking the container and `ViewportState`):
   - `wheel` (listener `{ passive: false }`, `preventDefault`): normalize `deltaMode` (lines × 16, pages × container height). If `ctrlKey || metaKey` (trackpad pinch sends ctrlKey), zoom by `Math.exp(-deltaY * 0.0015 * (deltaMode ? 16 : 1))` around the cursor. Else pan by `-deltaX, -deltaY` (Shift+wheel with only deltaY → horizontal).
   - Space held (keydown on window while not typing) → `panning` mode: cursor `grab`/`grabbing`; left drag pans. Middle-mouse drag always pans.
   - Touch: track pointers; two pointers → pinch zoom around the midpoint plus pan by midpoint delta.
   - Prevent browser zoom on `Mod+=` / `Mod+-` / `Mod+0` while the board is open.
6. **Shortcuts** (temporary local handler; step 11 moves them into the shortcut registry): `Shift+1` fit content (step 10 provides the bounds; for now fit `null` → reset to origin at 100%), `Shift+0` 100% around the center, `Mod+=` / `Mod+-` zoom steps around the center.
7. **ZoomControls** `src/lib/board/ui/ZoomControls.svelte`: a floating pill bottom-right: `−` button, a percentage button opening a menu (Zoom to fit · Zoom to 50% · 100% · 200%), `+` button. `aria-label`s on every button.
8. **Persistence:** `$effect` on x/y/zoom → debounced (500 ms) `boardsRepo.setViewport(id, vp)`; flush on destroy.
9. A temporary dev-only marker at world (0,0) (a small cross) to check panning. Remove it in step 10.

## Files
- create: `src/lib/board/engine/{viewport.ts, geometry.ts}`, `src/lib/board/viewport.svelte.ts`, `src/lib/board/canvas/{Canvas.svelte, viewportInput.ts}`, `src/lib/board/ui/ZoomControls.svelte`
- modify: `BoardWorkspace.svelte`, `context.ts`

## Tests
- `viewport.test.ts`: `screenToWorld(worldToScreen(p)) ≈ p`; `zoomAt` keeps the anchor fixed (for several zooms); clamping; `fitRect` centers the rect and respects `maxZoom` and padding; `nextZoomStep` at bounds; `visibleWorldRect` at zoom 2.
- `geometry.test.ts`: the rect helpers.
- `tests/e2e/viewport.spec.ts`: Ctrl+wheel changes the zoom label; reload restores the same zoom label.

## Acceptance criteria
- [ ] `pnpm verify` and `pnpm test:e2e` pass
- [ ] Trackpad pinch and two-finger pan feel native in Chrome and Firefox (manual; note it in PROGRESS)
- [ ] The page itself never scrolls or browser-zooms while on the board

## Out of scope
Elements (step 10), tools (step 11).

## Commit
`feat(canvas): add infinite canvas viewport with pan, zoom, grid and zoom controls`
