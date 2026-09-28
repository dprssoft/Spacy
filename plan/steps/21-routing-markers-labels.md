# Step 21 — Routing, markers, labels

Phase: E. Diagrams · Depends on: 20 · Estimate: 2 days

## Goal
Straight, elbow (orthogonal) and curved routing, seven marker types at either end, connector labels positioned along the path, and connector styling in the popover.

## Read first
- `00-architecture.md` §5 (ConnectorElement), §12 (default connector)
- `src/lib/board/diagram/endpoints.ts`, `src/lib/board/elements/connector/*`

## Tasks
1. **Routing core** `src/lib/board/diagram/routing/` (pure):
   ```ts
   export interface RouteInput {
     start: Point; end: Point;
     startDir: Point | null; endDir: Point | null;       // outward unit vectors
     startBox: Rect | null; endBox: Rect | null;         // AABBs of attached elements (for elbow avoidance)
     waypoints: Point[];
   }
   export interface Route { d: string; points: Point[] /* polyline approximation */; length: number }
   export function route(kind: Routing, input: RouteInput): Route
   export function pointAt(route: Route, t: number): { p: Point; angle: number }   // by arc length
   export function nearestT(route: Route, p: Point): { t: number; dist: number }
   ```
   - `straight.ts`: a polyline through the waypoints.
   - `curve.ts`: no waypoints → one cubic Bézier with `c1 = start + startDir*k`, `c2 = end + endDir*k`, `k = clamp(dist*0.4, 40, 200)`; a null dir points toward the other end. With waypoints → Catmull-Rom through all points converted to cubic segments. `points` = sampled at 24 steps per segment.
   - `elbow.ts`: orthogonal only. Stubs: `s1 = start + snapAxis(startDir)*20`, `e1 = end + snapAxis(endDir)*20` (a null dir → the axis toward the other point). Candidate routes between the stubs: HV, VH, HVH (split at mid x), VHV (split at mid y). Score = length + 1000 × (the number of segments crossing the interior of startBox/endBox) + 20 × bends. Pick the minimum and merge collinear points. With waypoints (step 22): route orthogonally through each waypoint in sequence, alternating axes.
   - `d` for straight and elbow = `M … L …`; elbow corners get a small 6 px rounding via quadratic joins (optional; skip if it complicates hit testing — `points` stays the sharp polyline).
2. **Markers** `src/lib/board/diagram/markers.ts` + `ConnectorMarkers.svelte`:
   - `markerPath(kind): { d: string; filled: boolean; refX; refY; w; h }` for arrow (filled narrow triangle), openArrow (two lines), triangle (hollow, filled with `--canvas-bg`), diamond (hollow), circle (filled), bar (a perpendicular line).
   - Render as SVG `<marker>` elements in each connector's own `<defs>` (unique ids `m-{connectorId}-start/end`), `orient="auto-start-reverse"`, `markerUnits="strokeWidth"`, sized so they look right at widths 1 to 8 (scale about `3 + 6/strokeWidth`), colored with the stroke color.
   - Shorten the path by the marker length at ends that have a marker? Not needed if `refX` places the tip at the endpoint. Verify visually.
3. **Connector view:** use `route()` with inputs from `resolveEndpoints` plus the attached elements' AABBs. Memoize with `$derived.by`. Hit testing uses `route.points` (distance to polyline ≤ `max(tol, strokeWidth/2 + 4/zoom)`) — put a shared `connectorGeometry(el, lookup)` cache in `diagram/geometry.ts` so the view, hit test, AABB and export (step 26) all use the same route.
4. **Labels:**
   - Rendered at `pointAt(route, label.t)` as an HTML div, centered and not rotated, in the font from the style (size s/m), with an optional background (`--canvas-bg`, 2 px 6 px padding, radius 4) when `label.background`.
   - Double-click the connector (select tool) → edit the label with the TextEditor pattern (a textarea at the label position). New labels start at `t = 0.5`. An empty label is not rendered.
   - Dragging the label (select tool, pointerdown on the label's box; hit-test labels before connector bodies) → `t = nearestT(route, pointer).t`.
5. **Popover options for connectors:** routing (3 icon buttons: straight / elbow / curve), start marker and end marker pickers (a dropdown of icon previews drawn with `markerPath`), stroke color, width, dash, opacity, label background toggle. Update `styleOptions` in the connector definition and add the controls to `StylePopover` (`routing`, `markers`, `labelBackground` options).
6. **Defaults:** `createConnector` now uses routing `elbow`, markerEnd `arrow`, markerStart `none`. "Set as default for connectors" (step 18 mechanism) stores routing and markers too (extend the stored default to `{ style, routing, markerStart, markerEnd }` for connectors).

## Files
- create: `src/lib/board/diagram/routing/{index.ts, straight.ts, curve.ts, elbow.ts, measure.ts}`, `src/lib/board/diagram/{markers.ts, geometry.ts}`, `src/lib/board/elements/connector/{ConnectorMarkers.svelte, ConnectorLabel.svelte}`, `src/lib/board/style/controls/{RoutingPicker.svelte, MarkerPicker.svelte}`
- modify: `ConnectorView.svelte`, `connector/definition.ts`, `StylePopover.svelte`, `options.ts`, `diagram/ops.ts`, `select.ts`, `styleDefaults.ts`

## Tests
- `routing.test.ts`: every route starts at `start` and ends at `end`; all elbow segments are axis-aligned; an elbow between two boxes side by side doesn't cross either box's interior; the curve length is ≥ the straight length; `pointAt(0)` = start, `pointAt(1)` = end, `pointAt(0.5)` is at the middle of the arc length; `nearestT` inverts `pointAt` within 1%.
- `markers.test.ts`: every marker kind returns a non-empty path.
- `tests/e2e/routing.spec.ts`: create two rects plus a connector via test hooks → switching routing in the popover changes the path's `d`; set the end marker to diamond → the marker element exists; double-click the connector → type "yes" → the label is visible; `toHaveScreenshot` of a fixture showing all 3 routings × 3 marker kinds (Chromium only).

## Acceptance criteria
- [ ] `pnpm verify` and `pnpm test:e2e` pass
- [ ] Elbow connectors leave the port perpendicular to the side and look tidy for the common cases: side by side, stacked, diagonal (manual screenshots noted in PROGRESS)
- [ ] Label dragging follows the path

## Out of scope
Manual waypoints (step 22), line jumps (never).

## Commit
`feat(diagram): add straight/elbow/curve routing, markers and connector labels`
