# Step 19 — Connectable interface

Phase: E. Diagrams · Depends on: 18 · Estimate: 1.5 days

## Goal
Every element type (except connectors) implements `Connectable`: outline, ports, port normals, ray exit point, and local↔world anchors. This is the architectural guarantee that **any object can be part of a diagram**.

## Read first
- `00-architecture.md` §3 (D7), §9 (Connectable)
- `src/lib/board/elements/registry.ts`, `src/lib/board/elements/shape/paths.ts`, `src/lib/board/engine/geometry.ts`

## Tasks
1. `src/lib/board/diagram/connectable.ts`:
   - The `Connectable` interface (from §9, verbatim).
   - `boxConnectable`: outline = the 4 rotated corners; ports = the rotated side midpoints (n = top-mid, e = right-mid, s = bottom-mid, w = left-mid); `portNormal` = the rotated unit vectors (0,-1), (1,0), (0,1), (-1,0); `rayExit(el, toward)`: intersect the ray from the center toward `toward` with the outline polygon edges, taking the nearest intersection with t > 0 (if `toward` equals the center, return the `e` port); `localToWorld(u, v)` = rotate `(x + u*w, y + v*h)` around the center; `worldToLocal` = the inverse, **not** clamped (callers clamp).
   - `polygonConnectable(localOutline: (el) => Point[])`: a factory for shapes whose outline isn't the box. The outline comes in local unrotated coordinates relative to `(x, y)`, gets rotated to world, and ports = the outline points hit by rays from the center in the 4 local axis directions (so a diamond's ports sit at its tips, an ellipse's at its extremes).
   - Geometry helpers in `engine/geometry.ts`: `raySegmentIntersection`, `rayPolygonExit`, `nearestPointOnPolygon`.
2. **Shape outlines:** in `shape/paths.ts` add `shapeOutline(kind, w, h): Point[]` (local coordinates): rect → 4 corners (ignore the corner radius); ellipse → 48-segment polygon; diamond → 4 tips. The step 22 kinds will add theirs here. The shape definition uses `polygonConnectable(el => shapeOutline(el.kind, el.w, el.h))`.
3. **Assign connectable in every definition:** shape → polygon; sticky, text, image, frame, doccard, stroke → `boxConnectable` (stroke: bounding box for now; convex hull is a later improvement); connector → `null`. Type `ElementDefinition.connectable` as `Connectable | null` (replacing the `unknown` from step 10).
4. `src/lib/board/diagram/index.ts`: `getConnectable(el): Connectable | null`, `isConnectable(el)`.
5. **Port hit helper:** `nearestPort(el, p: Point, radius: number): Port | null`.

## Files
- create: `src/lib/board/diagram/{connectable.ts, index.ts}`
- modify: `engine/geometry.ts`, `elements/shape/paths.ts`, all `elements/*/definition.ts`, `elements/registry.ts`

## Tests
- `connectable.matrix.test.ts` (**table-driven over `allDefinitions()`**, so future types are covered automatically). For every definition with a non-null `connectable`, and for rotations 0, π/4 and π/2, build a sample element via a `sampleElement(type)` fixture helper (create `src/lib/board/elements/fixtures.ts` with one valid sample per type) and assert:
  - each port lies on the outline (distance < 0.5)
  - each `portNormal` is unit length and points outward (`center + normal*10` is outside the outline, or on it for degenerate cases)
  - `rayExit` toward 8 directions lies on the outline and in the correct direction
  - `worldToLocal(localToWorld(u, v)) ≈ (u, v)` for a grid of u,v
  - a connector's definition has `connectable === null`
- `geometry.test.ts`: the new ray/polygon helpers.

## Acceptance criteria
- [ ] `pnpm verify` passes
- [ ] The matrix test iterates the registry (adding a new element type without a connectable makes it fail or explicitly opt out)
- [ ] `src/lib/board/diagram/connectable.ts` has no Svelte imports

## Out of scope
The connector element, tool and rendering (step 20+).

## Commit
`feat(diagram): add Connectable interface implemented by every element type`
