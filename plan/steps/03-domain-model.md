# Step 03 — Domain model

Phase: A. Foundation · Depends on: 01 · Estimate: 1.5 days

## Goal
A framework-agnostic model layer: types, Zod schemas, defaults, ids, z-order keys, transaction origins, Y.Doc accessors, write helpers, cloning and migrations. Fully unit-tested.

## Read first
- `00-architecture.md` §3 (D1, D2, D9), §5 (types and Y.Doc layout, **copy the types exactly**), §6 (origins), §12 (defaults)

## Tasks
1. Install: `pnpm add yjs zod nanoid fractional-indexing`.
2. `src/lib/model/types.ts`: the types from `00-architecture.md` §5, verbatim.
3. `src/lib/model/schema.ts`: Zod schemas mirroring every type (`styleSchema`, `endpointSchema`, one per element, `elementSchema` as a discriminated union on `type`). Export `parseElement(input: unknown): Element | null` (returns null on failure and `console.warn`s in dev only).
4. `src/lib/model/defaults.ts`:
   - `PALETTE`, `STICKY_COLORS`, `FONT_FAMILY`, `FONT_SIZE_PX: Record<FontSize, number>`, `LINE_HEIGHT = 1.35`, `RADIUS_PX`, `DEFAULT_SIZES`, `ZOOM_MIN`, `ZOOM_MAX`, `ZOOM_STEPS`, `GRID_SIZE = 24`
   - `DEFAULT_STYLE: Style` (fill `#ffffff`, fillStyle `solid`, stroke `#1e1e1e`, strokeWidth 2, dash solid, radius sm, shadow false, opacity 1, font m/regular/`#1e1e1e`/center/middle)
   - `baseStyleFor(type: ElementType): Style` with per-type tweaks: text → fill transparent, fillStyle none, stroke transparent, font align l / valign t; sticky → shadow true, radius sm, stroke transparent; frame → fill `#ffffff` fillStyle semi, stroke `#868e96`, strokeWidth 1; doccard → fill `#ffffff`, stroke `#e3e3e8`, strokeWidth 1, radius lg, shadow true, font align l / valign t / size s; stroke → fill transparent; connector → fill transparent.
   - `newElementBase(type, at: Point, style?: Style)` returning a `BaseElement` minus `z` (with the default size centered on `at`).
5. `src/lib/model/ids.ts`: `newId = () => nanoid(12)`.
6. `src/lib/model/zorder.ts` (wrap `fractional-indexing`):
   - `compareZ(a, b)` using plain `<` / `>`
   - `zAbove(z: string | null)`, `zBelow(z: string | null)`, `zBetween(a: string | null, b: string | null)`, `zManyAbove(z: string | null, n: number): string[]`
7. `src/lib/model/origins.ts`: `LOCAL`, `REMOTE_TAB`, `IMPORT`, `MIGRATION`, `TEMPLATE` as `Object.freeze({ name: '...' })`, and `type Origin`.
8. `src/lib/model/doc.ts`:
   - `getMeta(doc)`, `getElementsMap(doc): Y.Map<Y.Map<unknown>>`, `getDocsMap(doc): Y.Map<Y.XmlFragment>`
   - `readElement(ymap: Y.Map<unknown>): Element | null`: builds a plain object from all keys, then `parseElement`
   - `toYMap(el: Element): Y.Map<unknown>`: one key per top-level field; objects and arrays stored as plain JSON (structuredClone)
   - `listElements(doc): Element[]`, `getElement(doc, id): Element | null`, `maxZ(doc): string | null`, `minZ(doc): string | null`
9. `src/lib/model/ops.ts`. Every function takes `origin: Origin = LOCAL` and wraps its work in `doc.transact(..., origin)`:
   - `createElements(doc, els: Omit<Element,'z'>[] | Element[], origin?)`: assigns `z` above the current max for elements without `z` (keeping the given order); for doccards also creates `new Y.XmlFragment()` in `docs` when missing. Returns the created elements.
   - `updateElement(doc, id, patch: Partial<Element>, origin?)`: throws if the patch changes `id` or `type`; sets only keys whose value actually changed (deep-equal check for objects).
   - `updateElements(doc, patches: { id: string; patch: Partial<Element> }[], origin?)`
   - `deleteElements(doc, ids: string[], origin?)`: deletes elements and their `docs` entries. Leave a clearly named extension point: `export const beforeDeleteHooks: ((doc: Y.Doc, ids: Set<string>) => void)[] = []`, called inside the transaction before deleting. Step 20 registers the connector hook.
   - `setMeta(doc, key, value, origin?)`
10. `src/lib/model/clone.ts`: `cloneElements(els: Element[], opts: { offset: Point; idMap?: Map<string,string> }): { elements: Element[]; idMap: Map<string,string> }`. Gives new ids, remaps `groupId` (one new groupId per old one), remaps `parentId` if the parent is also cloned (otherwise keeps it), shifts `x/y` by `offset`, and removes `z` (so callers assign new keys). Connector endpoint remapping gets an extension point: `export const cloneHooks: ((el: Element, idMap: Map<string,string>) => Element)[] = []` (step 20).
11. `src/lib/model/migrations.ts`: `SCHEMA_VERSION = 1`; `migrations: Record<number, (doc: Y.Doc) => void>` (empty); `migrate(doc)`: reads `meta.schemaVersion` (undefined → 0), runs migrations `v+1..SCHEMA_VERSION` in one transaction with origin `MIGRATION`, and sets `schemaVersion`. If the stored version is greater than `SCHEMA_VERSION`, it throws `NewerSchemaError`.
12. `src/lib/model/index.ts`: re-exports the public API.

## Files
- create: everything in `src/lib/model/` listed above, plus tests

## Tests (`src/lib/model/*.test.ts`)
- `schema.test.ts`: a valid sample of each element type parses; invalid samples (missing field, wrong enum, unknown type) return null.
- `zorder.test.ts`: `zAbove`/`zBelow`/`zBetween` ordering; 1,000 sequential `zAbove` calls stay sorted under `compareZ`.
- `doc.test.ts`: `toYMap` → `readElement` round-trips equal to the input for every type.
- `ops.test.ts`: create assigns increasing z; a doccard gets a `docs` fragment; update changes only the given keys (spy on `ymap.set` or count Yjs updates); update throws on an id change; delete removes the element and its fragment; `beforeDeleteHooks` run; every op emits a transaction whose origin is the passed origin (`doc.on('afterTransaction')`).
- `clone.test.ts`: new ids, group remap, parent remap rules, offset.
- `migrations.test.ts`: a fresh doc gets `schemaVersion = 1`; a newer version throws.

## Acceptance criteria
- [x] `pnpm verify` passes, and coverage of `src/lib/model` is at least 90% lines (`pnpm vitest run --coverage src/lib/model`; install `@vitest/coverage-v8` if needed)
- [x] `src/lib/model` imports nothing from `svelte` or `.svelte` files
- [x] The types in `types.ts` match `00-architecture.md` §5 exactly

## Out of scope
Persistence (step 04/05), connector-specific logic (step 20).

## Commit
`feat(model): add element types, schemas, z-order, Y.Doc ops and migrations`
