# Step 05 — Board document lifecycle

Phase: B. Start page · Depends on: 04 · Estimate: 1 day

## Goal
Open, close, duplicate and delete board documents (Y.Doc + y-indexeddb), with live sync between browser tabs and "last edited" tracking.

## Read first
- `00-architecture.md` §3 (D1, D10), §5 (Y.Doc layout), §6 (board contents, cross-tab sync, origins)

## Tasks
1. Install: `pnpm add y-indexeddb`.
2. `src/lib/shared/debounce.ts`: `debounce(fn, ms)` returning a function with `.flush()` and `.cancel()`. `throttle(fn, ms)` too.
3. `src/lib/storage/tabSync.ts`: `createTabSync(doc: Y.Doc, channelName: string): () => void`
   - On `doc.on('update', (update, origin))`: if `origin !== REMOTE_TAB`, post `{ type: 'update', update }`.
   - On open: post `{ type: 'hello', sv: Y.encodeStateVector(doc) }`. Peers answer with `{ type: 'update', update: Y.encodeStateAsUpdate(doc, sv) }`.
   - On message `update`: `Y.applyUpdate(doc, update, REMOTE_TAB)`.
   - Returns cleanup (remove the listener, close the channel). No-op if `BroadcastChannel` is missing.
4. `src/lib/storage/boardDoc.ts`:
   ```ts
   export const boardDbName = (id: string) => `smthng-board-${id}`;
   export class BoardNotFoundError extends Error {}
   export interface OpenBoard { id: string; doc: Y.Doc; undo: Y.UndoManager; close(): Promise<void> }

   export async function openBoard(id: string): Promise<OpenBoard>
   ```
   - Throws `BoardNotFoundError` if `boardsRepo.get(id)` is undefined.
   - `new Y.Doc()` → `new IndexeddbPersistence(boardDbName(id), doc)` → `await persistence.whenSynced` → `migrate(doc)` → if `meta.title` is missing, set it from BoardMeta (origin `MIGRATION`).
   - `createTabSync(doc, 'smthng-board-' + id)`.
   - `undo = new Y.UndoManager(getElementsMap(doc), { trackedOrigins: new Set([LOCAL]), captureTimeout: 500 })` (D10: scope = the elements map only).
   - Track local edits: on `update` with origin `LOCAL`, call a debounced (2 s) `boardsRepo.touchUpdated(id)`.
   - `close()`: flush the debounce, destroy the undo manager, the tab sync and the persistence (`persistence.destroy()`), then `doc.destroy()`.
   - Add a comment at the provider wiring: `// Future: add a network provider (e.g. HocuspocusProvider) here.`
5. More functions in `boardDoc.ts`:
   - `loadSnapshot(id): Promise<Uint8Array>`: opens a temp Y.Doc with persistence, waits for sync, returns `Y.encodeStateAsUpdate(doc)`, destroys everything.
   - `writeSnapshot(id, update: Uint8Array, origin = IMPORT): Promise<void>`: new Y.Doc, apply the update, attach persistence, `await whenSynced`, then destroy (y-indexeddb stores the applied state).
   - `deleteBoardData(id): Promise<void>`: `deleteDB(boardDbName(id))` from `idb`.
   - `duplicateBoard(id): Promise<BoardMeta>`:
     1. `src = await boardsRepo.get(id)` (throw if missing)
     2. `meta = await boardsRepo.create({ title: `${src.title} (copy)` })`
     3. `assetMap = await assetsRepo.copyToBoard(id, meta.id)`
     4. load the snapshot into a temp Y.Doc, remap `assetId` of image elements via `updateElements(..., IMPORT)`, and set `meta.title`
     5. `writeSnapshot(meta.id, encodeStateAsUpdate(temp))`
     6. copy the thumbnail
     7. return the new meta
6. **Full board deletion without circular imports:** `boardDoc.ts` imports `boardsRepo`, so `boardsRepo` must not import `boardDoc`. Create `src/lib/storage/boardLifecycle.ts` exporting `destroyBoard(id)` (= `boardsRepo.destroy` + `assetsRepo.deleteByBoard` + `deleteBoardData`) and `purgeExpiredTrash()` (finds expired ids via `boardsRepo`, calls `destroyBoard` for each). UI code uses only these two functions for deletion.

## Files
- create: `src/lib/shared/debounce.ts`, `src/lib/storage/tabSync.ts`, `src/lib/storage/boardDoc.ts`, `src/lib/storage/boardLifecycle.ts`, tests
- modify: `src/lib/storage/boardsRepo.ts`

## Tests
- `debounce.test.ts` with fake timers.
- `boardDoc.test.ts` (fake-indexeddb):
  - Open, create an element via `createElements`, close, reopen: the element is present and `schemaVersion` is 1.
  - `openBoard('missing')` throws `BoardNotFoundError`.
  - A local edit calls `touchUpdated` after 2 s (fake timers or spy); an edit with origin `REMOTE_TAB` does not.
  - Undo reverts a `LOCAL` create; it does not revert a `REMOTE_TAB` create.
  - `duplicateBoard`: the copy has equal elements, remapped asset ids, title "X (copy)", and editing the copy doesn't change the original.
  - `destroyBoard` removes meta, assets and the y-indexeddb database (`indexedDB.databases()` if fake-indexeddb supports it, or reopening yields an empty doc).
- `tabSync.test.ts`: two Y.Docs with `createTabSync` on the same channel name (Node's `BroadcastChannel` delivers between instances in the same process) converge after an edit on either; the `hello` handshake syncs a doc that joins later. Use `await new Promise(r => setTimeout(r, 20))` to let messages arrive.

## Acceptance criteria
- [ ] `pnpm verify` passes
- [ ] `openBoard` is the only place that constructs `IndexeddbPersistence` for live editing
- [ ] Undo scope is `elements` only, tracking only `LOCAL`

## Out of scope
UI. Asset garbage collection (step 15).

## Commit
`feat(storage): add board document lifecycle with y-indexeddb and cross-tab sync`
