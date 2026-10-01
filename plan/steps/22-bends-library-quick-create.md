# Step 22 — Bends, shape library, quick-create, select connected

Phase: E. Diagrams · Depends on: 21 · Estimate: 2.5 days

## Goal
Manual connector bends with reset, a small flowchart shape library, quick-create "+" arrows on every connectable element, and "select connected". **Milestone M4.**

## Read first
- `00-architecture.md` §5 (ShapeKind, waypoints)
- `src/lib/board/diagram/routing/*`, `src/lib/board/elements/shape/paths.ts`, `src/lib/board/diagram/connectable.ts`

## Tasks
1. **Bends**
   - When a single connector is selected, show bend handles (small diamonds) in the overlay:
     - straight or curve: one handle at the midpoint of each route segment between consecutive points of `[start, ...waypoints, end]`; dragging it inserts a waypoint there (then moves it). Existing waypoints show as round handles; dragging moves them; double-clicking a waypoint handle removes it.
     - elbow: a handle at the middle of each **inner** segment (not the first or last stub). Dragging moves the segment perpendicular to its direction. Store it as waypoints: after the drag, take the current elbow polyline's inner corner points (with the moved segment applied), drop collinear points, and save them as `waypoints`. The elbow router honors waypoints (step 21).
   - One undo step per drag.
   - "Reset route" in the connector popover's "More" and in the context menu → `waypoints = []`.
   - When an attached element moves, the waypoints stay (acceptable behavior; document it in the tooltip "Reset route to auto-layout").
2. **Shape library** in `shape/paths.ts`, add for each new kind both `shapePath(kind, w, h, radius)` and `shapeOutline(kind, w, h)`:
   - `process` = rect; `decision` = diamond; `terminator` = stadium (radius h/2); `data` = parallelogram (skew 15% of w); `document` = rect with a wavy bottom (outline: rect with a bottom edge sampled from the wave); `database` = cylinder (outline: rect with a rounded top and bottom); `cloud` = arcs (outline: 32-point sampled path); `actor` = stick figure drawn in the box (outline: bounding box).
   - The connectable matrix test from step 19 must cover every kind (extend the fixtures to iterate `ShapeKind`).
   - **Library flyout:** the toolbar Shapes button opens a grid panel with Basic (rect, ellipse, diamond) and Flowchart (process, decision, terminator, data, document, database, cloud, actor), each with an icon preview drawn with `shapePath` and a tooltip. Click → the shape tool with that kind. Drag an icon onto the canvas (HTML5 DnD with a custom MIME) → create at the drop point at the default size.
   - `ShapeKindPicker` in the popover lists all kinds.
   - Default text alignment for every kind: center/middle.
3. **Quick-create** `src/lib/board/diagram/quickCreate.ts` + `QuickCreateButtons.svelte` (overlay):
   - Show when exactly one connectable element is hovered or selected with the select tool, not while dragging or editing: 4 small "+" circle buttons, 20 screen px outside each side midpoint (rotated with the element).
   - Click → `quickCreate(ctx, sourceId, dir: Port)`:
     - The new element has the **same type** as the source (shape keeps its kind and size; sticky keeps its color; text; doccard → empty with the title "Untitled"; image → a sticky instead, since images can't be copied meaningfully; frame → a same-size frame; stroke → a rect shape).
     - Style copied from the source. Text empty.
     - Placement: gap = 80 world px from the source's side along `dir` (in the source's rotation-free axis), aligned on the center line. If the target AABB intersects an existing element, shift it perpendicular by +(size + 40) until free, up to 5 tries.
     - Create a connector from the source port `dir` to the target's opposite port, with the connector defaults.
     - One undo step (a single transaction). Select the new element and start text editing if it's `editableText`.
   - Shift+click a "+" → a small picker (Shape kinds · Sticky · Text · Doc card) to choose the new element's type.
   - Keyboard: with one element selected, `Mod+Alt+ArrowRight/Left/Up/Down` → quick-create in that direction.
4. **Select connected** (`Mod+Shift+A`, also in the context menu): BFS from the selection across the connector index (element → connectors → the other endpoints' elements), selecting all elements and connectors reached.

## Files
- create: `src/lib/board/diagram/{quickCreate.ts, selectConnected.ts, shapeLibrary.ts}`, `src/lib/board/canvas/{QuickCreateButtons.svelte, BendHandles.svelte}`, `src/lib/board/ui/ShapeLibraryPanel.svelte`
- modify: `shape/paths.ts`, `shape/definition.ts`, `ShapeKindPicker.svelte`, `Toolbar.svelte`, `select.ts`, `handles.ts`, `StylePopover.svelte`, `CanvasContextMenu.svelte`, `shortcuts.ts`, `elements/fixtures.ts`

## Tests
- Extend `connectable.matrix.test.ts` over all `ShapeKind`s.
- `quickCreate.test.ts`: placement in each direction; collision shifting; the connector is attached to the correct ports; one transaction.
- `selectConnected.test.ts`: a chain and a branch; ignores unconnected elements.
- `elbow waypoints` test: after setting waypoints the route passes through them and stays orthogonal.
- `tests/e2e/diagram.spec.ts`: create a process shape → click the right "+" three times in a row (each time on the newest shape) → 4 shapes and 3 connectors; Mod+Shift+A on the first selects 7 items; drag an elbow segment → `waypoints` is non-empty → Reset route → empty. **Mixed diagram:** sticky → doc card → image → shape connected via quick-create or the connector tool, all attached.

## Acceptance criteria
- [x] `pnpm verify` and `pnpm test:e2e` pass
- [ ] A 20-node mixed diagram can be built in under 3 minutes (manual; note the time in PROGRESS)
- [x] **M4 demo:** connect anything to anything, style it, bend it, reset it

## Out of scope
Swimlanes, auto-layout, connector-to-connector junctions.

## Commit
`feat(diagram): add connector bends, flowchart shape library, quick-create and select connected`
