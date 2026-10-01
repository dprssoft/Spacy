# Step 20 — Connector tool and endpoints

Phase: E. Diagrams · Depends on: 19 · Estimate: 2 days

## Goal
Connectors that attach to any connectable element via a port, a floating attachment or a fixed point, follow their elements as they move, survive element deletion as free ends, and are remapped on copy and duplicate. Straight rendering only; routing comes in step 21.

## Read first
- `00-architecture.md` §3 (D7, D8), §5 (Endpoint, ConnectorElement, rules), §7 (ConnectorIndex)
- `src/lib/board/diagram/connectable.ts`, `src/lib/model/{ops.ts, clone.ts}`

## Tasks
1. **Endpoint resolution** `src/lib/board/diagram/endpoints.ts` (pure):
   ```ts
   export type Lookup = (id: string) => Element | undefined;
   resolveEndpoints(c: ConnectorElement, lookup: Lookup): { start: Point; end: Point; startDir: Point | null; endDir: Point | null }
   ```
   - free → `{x, y}`, dir null
   - port → `ports(el)[port]`, dir = `portNormal`
   - fixed → `localToWorld(u, v)`, dir = the outward normal of the nearest outline edge
   - float → resolve the other end first (if the other end is also float, use the other element's center), then `rayExit(el, otherPoint)`; dir = the normalized (exit − center)
   - Element missing (deleted remotely) → `{lastX, lastY}`, dir null
   - `makeEndpoint(el, p: Point, mode: 'auto' | 'fixed', portRadius: number): Endpoint`: auto → a port if within `portRadius` of one, else float; fixed → `worldToLocal` clamped to [0,1]. Fill `lastX/lastY` with the resolved point.
2. **Connector index** `src/lib/board/diagram/connectorIndex.ts`: `Map<elementId, Set<connectorId>>`, maintained by `BoardStore` on connector add, update and remove. `connectorsOf(elementId)`. After an element change, `BoardStore` also refreshes the spatial index AABB of its connectors (`connectorAABB` = the bounds of the resolved points, expanded by the stroke width and 8 px).
3. **Connector definition** `src/lib/board/elements/connector/`:
   - `ConnectorView.svelte`: the connector's wrapper is special: position `(0,0)`, no size, `overflow: visible`. It renders an `<svg overflow="visible">` with an absolute world-coordinate path. **Reactivity:** it reads `store.get(fromId)` / `store.get(toId)` in `$derived`, so it re-renders when either attached element changes (`SvelteMap` granularity).
   - For now the path is a straight line `M start L end` with the stroke, width, dash and opacity from the style, plus a simple end arrow (a full marker set comes in step 21).
   - `definition.ts`: `aabb` computed from resolved endpoints (needs lookup; the definition receives it through a module-level `setLookup(store.get)` or `aabb(el, lookup)`; pick one and document it); `hitTest` = distance to the segment ≤ `max(tol, strokeWidth)`; `connectable: null`; `resizable: false`; `rotatable: false`.
   - `ElementView` special-cases connectors (no translate/rotate/size).
   - Culling: connectors are visible if their AABB intersects the view **or** either endpoint element is visible.
4. **Diagram ops** `src/lib/board/diagram/ops.ts`:
   - `createConnector(doc, from: Endpoint, to: Endpoint, style?: Partial<...>)`: defaults from §12 (routing `straight` for now; step 21 switches it to `elbow`).
   - Register a **`beforeDeleteHooks`** entry: for every connector not being deleted that references a deleted element, convert that endpoint to `{ kind: 'free', x, y }` at its current resolved point (resolve with a lookup over the doc).
   - Register a **`cloneHooks`** entry: connector endpoints referencing ids in `idMap` get remapped; those referencing elements outside the clone set become free at their `lastX/lastY` resolved position.
   - Do **not** refresh `lastX/lastY` when attached elements move (D8: moving never writes to connectors). The delete hook runs in whichever tab performs the deletion, with the full doc available, so `lastX/lastY` is only a last-resort fallback.
5. **Connector tool** `tools/connector.ts` (A):
   - pointerdown: target = `hitElement` (connectable only) → start endpoint `makeEndpoint(el, p, alt ? 'fixed' : 'auto', 12 / zoom)`, else free at `p`.
   - move: preview line in the overlay; the hover target (connectable, not the start element unless self-loop is allowed — **disallow self-loops**) gets a highlighted outline polygon and 4 port dots (overlay `ConnectTargetHighlight.svelte`); the port under the pointer is emphasized.
   - pointerup: if the screen length is under 8 px → cancel; else `createConnector` → select it → `returnToSelect()`.
6. **Connect from the select tool:** when hovering a single connectable element with the select tool, show its 4 port dots (small, subtle). Pointerdown on a port dot (a registered handle provider) starts the same connector gesture as the connector tool.
7. **Editing endpoints:** a selected connector shows two endpoint handles (circles) instead of box handles. Dragging one re-runs the attach logic (hover highlight, port snapping, Alt = fixed) and updates `from` or `to`. Dropping on empty space → free.
8. **Moving:** connectors whose both ends are free move with the selection like other elements (translate the free points). Attached ends are never translated (they follow their elements). Connectors with at least one attached end can't be dragged by the body alone (the drag is ignored unless other elements are selected too).
9. **"Select dangling connectors"** in the empty-canvas context menu: selects connectors with at least one free end.
10. Enable the Connector toolbar button.

## Files
- create: `src/lib/board/diagram/{endpoints.ts, connectorIndex.ts, ops.ts}`, `src/lib/board/elements/connector/*`, `src/lib/board/tools/connector.ts`, `src/lib/board/canvas/ConnectTargetHighlight.svelte`
- modify: `boardStore.svelte.ts`, `ElementView.svelte`, `ElementsLayer.svelte`, `select.ts`, `SelectionOverlay.svelte`, `handles.ts`, `CanvasContextMenu.svelte`, `elements/index.ts`, `Toolbar.svelte`

## Tests
- `endpoints.test.ts`: each endpoint kind resolves correctly for a rect at rotation 0 and 45°; float/float uses the centers; a missing element falls back to last; `makeEndpoint` picks a port within the radius, else float; fixed clamps.
- `diagram/ops.test.ts`: deleting an attached element converts the endpoint to free at the correct point, in the same transaction (one undo restores both); clone remapping (inside the set → remapped, outside → free).
- `connectorIndex.test.ts`.
- `tests/e2e/connect.spec.ts`: for each pair among [rect, sticky, text, image, doccard placeholder, frame, stroke] (choose 4 representative pairs to keep it fast, plus one test looping over all types connecting to a rect): create both via test hooks → the connector tool drags from A to B → the connector exists with `from.elementId = A` and `to.elementId = B` → move B via a drag → the connector's path `d` attribute changed and its end lies on B's outline (checked via hooks).

## Acceptance criteria
- [x] `pnpm verify` and `pnpm test:e2e` pass
- [x] Connectors stay attached through move, resize, rotate, duplicate (both selected) and undo/redo
- [x] Deleting an attached element leaves a free-ended connector; undo reattaches it
- [x] Moving a shape writes nothing to connector elements (verify: count Yjs updates on the connector map during a drag = 0)

## Out of scope
Elbow and curve routing, markers, labels (step 21); waypoints (step 22).

## Commit
`feat(diagram): add connectors attachable to any element with port, floating and fixed anchors`
