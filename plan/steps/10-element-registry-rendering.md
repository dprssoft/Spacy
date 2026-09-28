# Step 10 — Element registry, board store, rendering

Phase: C. Canvas · Depends on: 09 · Estimate: 2 days

## Goal
The reactive bridge from Yjs to Svelte, a spatial index, an element registry, rendering of shapes, stickies and text (plus placeholders for other types), viewport culling, a perf test board, and test hooks.

## Read first
- `00-architecture.md` §3 (D4, D6), §5, §7, §8, §9 (ElementDefinition), §12

## Tasks
1. Install: `pnpm add rbush && pnpm add -D @types/rbush`.
2. **Geometry** (extend `src/lib/board/engine/geometry.ts`): `rotatePoint(p, center, angle)`, `rectCorners(rect, rotation): Point[]`, `rotatedAABB(rect, rotation): Rect`, `pointInRotatedRect(p, rect, rotation, tol)`, `distToSegment(p, a, b)`, `polygonContains(poly, p)`, `rectFromPoints(a, b)`.
3. **Spatial index** `src/lib/board/engine/spatialIndex.ts`: a class over `rbush` with `upsert(id, aabb)`, `remove(id)`, `search(rect): string[]`, `clear()`, `size`. Keep a `Map<id, item>` for removals.
4. **Registry** `src/lib/board/elements/registry.ts`: the `ElementDefinition` interface from §9 (`connectable` is typed as `unknown | null` for now and gets its real type in step 19; `styleOptions: string[]` until step 17). `registerElement(def)`, `getDefinition(type)`, `allDefinitions()`. Register everything in `src/lib/board/elements/index.ts`.
5. **Default helpers** `src/lib/board/elements/common.ts`: `boxAABB(el) = rotatedAABB(el, el.rotation)`, `boxHitTest(el, p, tol) = pointInRotatedRect(...)`, `styleToCss(style)` (opacity, shadow → `filter: drop-shadow(0 2px 6px rgba(0,0,0,.15))`), `fontToCss(font)` (size px, weight, style, color, text-align, `LINE_HEIGHT`, `FONT_FAMILY`), `valignToJustify(valign)`, `dashArray(dash, width)` (dashed `[4w, 3w]`, dotted `[0, 2w]` with round caps), `fillColor(style)` (semi → the color with 25% alpha via `color-mix(in srgb, <fill> 25%, transparent)`).
6. **Element definitions and views** (`src/lib/board/elements/<type>/definition.ts` + `<Type>View.svelte`):
   - `shape`: `paths.ts` with `shapePath(kind, w, h, radius): string` for `rect` (rounded by `RADIUS_PX`), `ellipse`, `diamond`. Other kinds fall back to rect until step 22. The view is an `<svg width=w height=h overflow="visible">` with the path (fill, stroke, dash, stroke inset handled by drawing within the box) plus an HTML text layer (`absolute inset-0 flex p-2`, alignment from font, `white-space: pre-wrap; overflow-wrap: anywhere`).
   - `sticky`: a div with the sticky color, radius, shadow, `p-4`, dark text, font from style.
   - `text`: a div with `white-space: pre-wrap`, font from style, no background.
   - `image`, `stroke`, `frame`, `doccard`, `connector`: a **placeholder** definition rendering a dashed box labelled with the type (replaced in steps 15, 16, 20, 23). Connector placeholder AABB = zero rect.
   - All: `resizable: true`, `rotatable: true` (connector false), `keepAspect: false`, `editableText` true for shape/sticky/text.
7. **Board store** `src/lib/board/boardStore.svelte.ts`, exactly as in §7:
   - Initial load: `listElements(doc)` → fill `elements`, index and order.
   - `getElementsMap(doc).observeDeep(handler)`: collect changed ids (top-level `keysChanged` for adds/deletes; nested `event.path[0]` for field changes), re-read each with `readElement`, update `elements` (set/delete), `index.upsert/remove` with `getDefinition(type).aabb(el)`, and recompute `order` / `frameOrder` only if an element was added or removed, or its `z` changed.
   - `version = $state(0)`, incremented once per handled transaction (a cheap "something changed" signal).
   - `contentBounds(): Rect | null` (union of all AABBs).
   - Add `store` to `BoardContext`.
8. **Rendering**
   - `src/lib/board/elements/ElementView.svelte`: props `id`. Reads `store.get(id)`; the wrapper `div` is `absolute left-0 top-0 pointer-events-none`, with style width/height and `transform: translate(x px, y px) rotate(rotation rad)`, `transform-origin: center`, `data-element-id={id}`, `data-type`. It renders `definition.component` with `{ el, editing: false }`.
   - `src/lib/board/canvas/ElementsLayer.svelte`: computes visible ids = `store.index.search(expandRect(visibleWorldRect, 50%))` into a Set (recomputed when the viewport or `store.version` changes, throttled to one rAF). Renders frames first (`frameOrder` ∩ visible), then `order` ∩ visible, with keyed `{#each}`. A prop `alwaysRender: Set<string>` (selection/editing, from step 11).
   - Wire `Shift+1` fit to `store.contentBounds()`.
   - Remove the step 09 origin marker.
9. **Test hooks** `src/lib/dev/testHooks.ts`: `installTestHooks(ctx: BoardContext)`. If `import.meta.env.DEV || getPref('testHooks', false)`, it sets `window.__smthng = { ctx, createElements: (els) => createElements(ctx.doc, els), list: () => listElements(ctx.doc), clear: () => ... }`. Call it from `BoardWorkspace`. Type `window.__smthng` in `src/app.d.ts`.
10. **Perf board** `src/lib/dev/perfBoard.ts`: `generatePerfElements(n = 3000, seed = 1): Element[]` (deterministic PRNG; mixed shapes, stickies and texts over a 10,000 × 10,000 area). In dev, `?debug=perf` shows a small floating button "Generate 3,000 elements".
11. `tests/e2e/helpers.ts`: add `enableTestHooks(page)` (`page.addInitScript(() => localStorage.setItem('smthng:testHooks', 'true'))`) and `createBoard(page)`, which returns the board id.

## Files
- create: `src/lib/board/engine/spatialIndex.ts`, `src/lib/board/elements/{registry.ts, index.ts, common.ts, ElementView.svelte, shape/*, sticky/*, text/*, placeholder/*}`, `src/lib/board/boardStore.svelte.ts`, `src/lib/board/canvas/ElementsLayer.svelte`, `src/lib/dev/{testHooks.ts, perfBoard.ts}`
- modify: `geometry.ts`, `Canvas.svelte`, `BoardWorkspace.svelte`, `context.ts`, `app.d.ts`, `tests/e2e/helpers.ts`

## Tests
- `geometry.test.ts`: rotated AABB at 0/45/90°, point in rotated rect, distance to segment.
- `spatialIndex.test.ts`: upsert/search/remove/update.
- `boardStore.svelte.test.ts`: the store reflects create/update/delete; a `REMOTE_TAB` update is reflected; `order` follows z and changes on a z update; an update of one element doesn't replace other snapshots (identity check); `contentBounds`.
- `tests/e2e/render.spec.ts`: with test hooks, create a rect, a sticky and a text → three `[data-element-id]` nodes are visible; reload → still three.

## Acceptance criteria
- [x] `pnpm verify` and `pnpm test:e2e` pass
- [ ] Perf board: panning with 3,000 elements stays at 55 fps or more in the Chrome performance panel (manual; record fps in PROGRESS)
- [x] Culling works: at 100% zoom the DOM has far fewer than 3,000 `[data-element-id]` nodes

## Out of scope
Interaction (step 11+), the real image/stroke/frame/doccard/connector views.

## Commit
`feat(canvas): add board store, spatial index, element registry and culled rendering`
