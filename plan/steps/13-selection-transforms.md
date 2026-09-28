# Step 13 — Selection and transforms

Phase: C. Canvas · Depends on: 12 · Estimate: 2 days

## Goal
Full select-tool behavior: click, Shift and marquee selection, groups-aware selection, move (with Alt-duplicate and axis lock), resize (8 handles, aspect and center modifiers), rotate (15° snapping), multi-element transforms, nudging, select all, and hover highlight.

## Read first
- `00-architecture.md` §3 (D5, D6), §8
- `src/lib/board/tools/select.ts`, `src/lib/board/engine/geometry.ts`

## Tasks
1. **Pure transform math** `src/lib/board/engine/transform.ts`:
   ```ts
   export type Box = { x: number; y: number; w: number; h: number; rotation: number };
   selectionBox(els: Element[]): Box                 // single → its rotated box; multiple → AABB union (rotation 0)
   resizeBox(start: Box, handle: HandleId, pointerWorld: Point, opts: { keepAspect: boolean; fromCenter: boolean; minSize: number }): Box
     // works in the box's local (unrotated) frame; the opposite handle stays fixed (or the center if fromCenter)
   scaleElementsToBox(els: Element[], from: Box, to: Box): Partial<Element>[] // multi-select: map positions/sizes proportionally (rotation-0 boxes)
   rotateElementsAround(els: Element[], center: Point, delta: number): Partial<Element>[]
   snapAngle(angle: number, step = Math.PI / 12): number
   ```
   Strokes: when scaled, points are scaled too (`points` multiplied by `sx`, `sy`). Connectors are skipped (derived geometry).
2. **Selection overlay** `src/lib/board/canvas/SelectionOverlay.svelte` in the screen-space overlay:
   - For each selected element: a thin outline (rotated) in `--selection`.
   - A selection box (from `selectionBox`) with 8 square handles (8×8 px, white fill, accent border) and a rotation handle (a circle 24 px above the top center, rotated with the box). No handles if the selection contains only connectors, or if every element is locked (show a lock badge instead). No resize handles for elements with `resizable: false`.
   - The hover outline (`selection.hoverId`, not selected) in a lighter accent.
   - Marquee rectangle (accent border, 8% accent fill).
   - Register a handle provider (`handles.ts`) returning a `HandleId` when the screen point is within 6 px of a handle.
3. **Select tool state machine** (rewrite `tools/select.ts`). States: `idle → pointingElement → dragging | pointingCanvas → marquee | pointingHandle → resizing | rotating`.
   - pointerdown on a handle → resizing/rotating (`undo.stopCapturing()`, snapshot the starting elements).
   - pointerdown on an element: resolve the **group**: if the element has a `groupId` and the selection doesn't already contain it, select all elements of that group. Shift → toggle (the group as a unit). Then prepare to drag.
   - pointerdown on empty → marquee (Shift = add to the existing selection).
   - Drag threshold 3 screen px.
   - **Move:** translate all selected (unlocked) elements by the delta through `rafBatch` + `updateElements`. Shift → lock to the dominant axis. **Alt at drag start** → duplicate the selection first (`cloneElements`, offset 0, new z above) and move the copies.
   - **Resize:** single → `resizeBox` (keepAspect = Shift XOR `definition.keepAspect`, fromCenter = Alt). Multi → `scaleElementsToBox`.
   - **Rotate:** angle from the center to the pointer; Shift → `snapAngle`. Multi → `rotateElementsAround`.
   - **Marquee:** live selection = `hitElementsInRect(rect, 'intersect')` minus locked elements, expanded to whole groups.
   - pointerup: finish; `rafBatch.flush()`.
   - Double-click on a group member while the group is selected → select only that member ("enter group").
   - Locked elements: can be selected by click, never moved, resized or rotated; excluded from marquee.
4. **Keyboard** (tool `onKeyDown` or shortcuts): arrows nudge 1 px (Shift 10 px), one undo step per burst (the capture timeout handles it). `Mod+A` selects all (unlocked, non-frame elements plus frames). `Shift+2` zooms to the selection (`viewport.animateTo(fitRect(bounds))`).
5. **Hover:** update `selection.hoverId` from `hitElement` on pointermove when idle.
6. Selected elements are always rendered (culling).

## Files
- create: `src/lib/board/engine/transform.ts`, `src/lib/board/canvas/SelectionOverlay.svelte`
- modify: `tools/select.ts`, `handles.ts`, `Canvas.svelte`, `shortcuts.ts`

## Tests
- `transform.test.ts` (heavy, table-driven):
  - `resizeBox` for each of the 8 handles at rotation 0 and 30°: the opposite corner stays fixed in world space (±0.01).
  - keepAspect keeps w/h; fromCenter keeps the center; minSize is respected; dragging past the opposite edge clamps to minSize (no negative sizes).
  - `scaleElementsToBox` maps corners correctly; stroke points scale.
  - `rotateElementsAround` by 90° moves the centers correctly and adds to the rotation.
  - `snapAngle`.
- `tests/e2e/select.spec.ts`: create two rects → marquee both → drag → both moved by the same delta → Mod+Z restores both in one step. Resize with the SE handle changes the size. Alt+drag creates a copy. Shift+click toggles.

## Acceptance criteria
- [ ] `pnpm verify` and `pnpm test:e2e` pass
- [ ] Rotated elements resize naturally (the opposite corner stays pinned; manual)
- [ ] Each gesture is one undo step
- [ ] Dragging 1 element among 3,000 (perf board) stays at 55 fps or more

## Out of scope
Grouping commands (step 14), snapping and guides (step 18), frame membership (step 16).

## Commit
`feat(select): add marquee, group-aware selection, move, resize and rotate transforms`
