# Step 48 — Board list sync

Phase: L. Sync · Depends on: 47 · Estimate: 1.5 days

> **Needs approval by the human (data model):** adds a per-user **library** Y.Doc that the start page's `boards` store is reconciled with. D3 stays: the start page still reads the local `boards` store.

## Goal
Creating, renaming, starring, trashing, restoring and deleting boards on one device shows up on the others, with sensible results when two devices change the same board at the same time.

## Design (for approval)
- **Library doc** (synced by the step 47 engine like a board, files `kind=update, board=library`):
  ```ts
  library.getMap('boards'): Y.Map<boardId, Y.Map<{
    createdAt: number; starred: boolean; deletedAt: number | null; purgedAt: number | null;
  }>>
  ```
  - Per-field last-writer-wins comes from Y.Map semantics.
  - **Title** stays in the board doc (`meta.title`, already kept in sync with the list); the reconciler copies it into the `boards` store when a board's doc changes.
  - **Device-local, never synced:** `openedAt`, `viewport`, `thumbnail` (each device draws its own thumbnail on next open or idle).
- **Tombstones:** "Delete forever" sets `purgedAt`. Other devices then delete the board's local data (`destroyBoard`), and the engine deletes the board's remote files. Tombstones are kept (a few bytes each), so a device that comes back after months doesn't resurrect the board.
- **Trash expiry** (30 days) runs on any device and goes through the same tombstone.
- **Reconciler** (`storage/sync/library.ts`): `boards` store ↔ library doc, both ways. It's idempotent and runs after each sync cycle and after local `boardsRepo` writes. A board present remotely but not locally is created locally (title from its doc once downloaded; "Syncing…" placeholder until then).
- **First connect:** the local library and remote library merge; nothing is overwritten.

## Tasks
1. Library doc storage (its own y-indexeddb database `spacy-library`), engine registration.
2. Reconciler both ways; `boardsRepo` writes notify it.
3. Tombstones: purge, expiry, remote file deletion, local `destroyBoard` on other devices.
4. Placeholder state on the start page for boards whose content hasn't downloaded yet.

## Tests
- `library.test.ts`:
  - create, rename, star, trash, restore and purge on A arrive on B
  - concurrent star on A and trash on B both apply
  - a purge beats a later edit from a device that was offline
  - first connect merges two existing libraries
  - reconciler idempotence
- `boardsRepo` integration: local writes reach the library.

## Acceptance criteria
- [ ] `pnpm verify` passes
- [ ] `00-architecture.md`: §5 the library doc, §6 `spacy-library`, §14 reconciliation and tombstones

## Out of scope
Images (step 49), Google Drive and UI (step 50).

## Commit
`feat(sync): sync the board list between devices`
