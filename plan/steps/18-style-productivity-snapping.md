# Step 18 — Style productivity, alignment, snapping

Phase: D. Styling · Depends on: 17 · Estimate: 2 days

## Goal
Quick-style presets, copy/paste style, "set as default", align/distribute/match size, smart guides, and grid snapping. **Milestone M3.**

## Read first
- `00-architecture.md` §5 (`meta.stylePresets`), §6 (localStorage keys), §11
- `src/lib/board/style/*`, `src/lib/board/tools/select.ts`

## Tasks
1. **Quick styles** `src/lib/board/style/quickStyles.ts`:
   - `DEFAULT_PRESETS: Style[]` (8): Neutral (white fill, dark stroke), Blue (`#a5d8ff` fill, `#1971c2` stroke), Green, Yellow, Red, Violet, Dark (`#1e1e1e` fill, white text), Outline (transparent fill, dark stroke, dashed).
   - `getPresets(doc)`: `meta.stylePresets` or the defaults. `updatePreset(doc, i, style)`: writes the whole array to `meta` (origin LOCAL).
   - UI: a row of 8 swatches at the start of the popover (a mini preview: a small rounded square with fill and stroke). Click → apply the preset's fill, fillStyle, stroke, dash and font color (only the keys in the target's options). Right-click → a menu "Update from selection".
2. **Copy/paste style** (`Mod+Alt+C` / `Mod+Alt+V`) `src/lib/board/style/styleClipboard.ts`: store the first selected element's `style` (plus `color` for a sticky) in memory and in `localPrefs` `copiedStyle`; paste applies only the options each target supports.
3. **Defaults:** extend `getDefaultStyle(type)` to merge `localPrefs` `defaults:<type>`. In "More": "Set as default for new {type label}" and "Reset default". Applies to new elements of that type.
4. **Align and distribute** `src/lib/board/engine/align.ts` (pure, AABB-based):
   - `align(els, edge: 'left'|'hcenter'|'right'|'top'|'vcenter'|'bottom'): Patch[]`: relative to the selection bounds.
   - `distribute(els, axis: 'h'|'v'): Patch[]`: equal gaps between AABBs, the outermost stay fixed (≥ 3 elements).
   - `matchSize(els, dim: 'w'|'h'|'both'): Patch[]`: to the largest.
   - Skip connectors and locked elements; for rotated elements, translate so the AABB aligns.
   - UI: when ≥ 2 are selected, the popover shows an "Arrange" button → a panel with the 6 align icons, 2 distribute icons (enabled at ≥ 3), and match width/height.
5. **Snapping** `src/lib/board/engine/snapping.ts` (pure):
   ```ts
   export interface SnapResult { dx: number; dy: number; guides: { axis: 'x'|'y'; at: number; from: number; to: number }[] }
   snapMove(moving: Rect, candidates: Rect[], threshold: number): SnapResult
   snapResizeEdge(...)  // snap the moving edges of a resized box to candidate lines
   snapToGrid(value: number, grid: number): number
   ```
   - Candidate lines per rect: x → left, centerX, right; y → top, centerY, bottom. For each axis, find the smallest distance within `threshold = 6 / zoom` and emit guides spanning both rects.
   - Candidates: `index.search(visibleWorldRect)` minus the moving elements (and minus their children for frames), capped at the 300 nearest.
   - Integrate into the select tool's move and resize and into the shape/frame creation drags. **Alt held disables snapping.**
   - Grid snapping (`localPrefs` `snap`, toggled with `Mod+'`): when on, snap positions and sizes to `GRID_SIZE`; smart guides take priority when both are within the threshold.
   - `SnapGuides.svelte` in the overlay: 1 px accent lines, plus small x marks at the snapped points.
6. **View menu:** extend the zoom percentage menu with toggles "Show grid" (pref `grid`) and "Snap to grid" (pref `snap`).

## Files
- create: `src/lib/board/style/{quickStyles.ts, styleClipboard.ts, ArrangePanel.svelte, QuickStyles.svelte}`, `src/lib/board/engine/{align.ts, snapping.ts}`, `src/lib/board/canvas/SnapGuides.svelte`
- modify: `styleDefaults.ts`, `StylePopover.svelte`, `select.ts`, `shape.ts`, `frame.ts`, `ZoomControls.svelte`, `shortcuts.ts`

## Tests
- `align.test.ts`: every edge; distribute with unequal sizes gives equal gaps; matchSize.
- `snapping.test.ts`: snaps to the nearest line within the threshold; no snap beyond it; the guide extents; x and y independently; grid snap.
- `quickStyles.test.ts`: defaults when meta is empty; update persists.
- `tests/e2e/arrange.spec.ts`: two rects at different x → Align left → equal `x` (via test hooks). Drag a rect near another's left edge → it snaps (final x equals the other's x). Holding Alt → no snap.

## Acceptance criteria
- [x] `pnpm verify` and `pnpm test:e2e` pass
- [x] Guides appear while dragging and disappear on release
- [x] **M3 demo:** everything is styleable, quick styles work, tidying with align/distribute works

## Out of scope
Equal-spacing guides, rotation snapping to other elements.

## Commit
`feat(style): add quick styles, copy/paste style, defaults, align/distribute and smart guides`
