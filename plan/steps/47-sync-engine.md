# Step 47 — Sync engine (boards)

Phase: L. Sync · Depends on: 32 · Estimate: 2.5 days

> **Needs approval by the human before starting.** Lifts the "server sync" non-goal for **single-user sync between your own devices through your own cloud storage** (no accounts of ours, no server of ours, no sharing or collaboration). Adds §14 "Sync" to `00-architecture.md`. The board format doesn't change.

## Goal
A storage-agnostic engine that keeps every board's Yjs document in sync with a remote file store, so the same boards show up on all of a user's devices. This step builds the engine against an in-memory store; Google Drive plugs in at step 50. Nothing is visible to users yet.

## Design (for approval)
- **`RemoteStore` interface** (`src/lib/storage/sync/remote.ts`): a flat store of immutable files with metadata. Every operation can fail and is retried by the engine.
  ```ts
  interface RemoteFile { id: string; name: string; props: Record<string, string>; size: number }
  interface RemoteStore {
    changes(cursor: string | null): Promise<{ files: RemoteFile[]; removed: string[]; cursor: string }>;
    create(name: string, props: Record<string, string>, body: Uint8Array | Blob): Promise<RemoteFile>;
    read(id: string): Promise<Uint8Array>;
    remove(id: string): Promise<void>;
  }
  ```
  `MemoryRemoteStore` implements it for tests (with injectable failures and latency).
- **Board files:** `kind=update, board=<id>, device=<deviceId>, seq=<n>`. Each holds one Yjs update. Files are never edited, only created and deleted, so two devices never write the same file.
- **Upload by state vector:** per board, the engine stores `syncedSV` in IndexedDB: the board's state vector right after the last cycle in which everything local was uploaded and everything remote applied. The next upload is `encodeStateAsUpdate(local, syncedSV)`, the exact set of changes since. There's no outbox to keep consistent, and edits made offline or while sync was off are picked up automatically.
- **Download:** new remote files (by `changes` cursor) are applied with origin `REMOTE_SYNC` (new, in `origins.ts`, so they stay out of undo). They're applied to the open `Y.Doc` if the board is open in this tab, otherwise merged into IndexedDB (`writeSnapshot`). Boards open in **other tabs** get them through the board's tab-sync channel.
- **Compaction:** when a board has ≥ 50 remote files, a device uploads one file with the merged state (`kind=snapshot`), then deletes only the files it had merged. Files from other devices that it hadn't seen yet stay. Yjs merges are idempotent, so two devices compacting at once is safe.
- **One syncing tab per browser:** a Web Lock (`navigator.locks.request('spacy-sync')`) picks the leader; other tabs stay passive. If the lock API is missing, the tab syncs anyway (duplicate uploads are harmless).
- **Device id:** random, kept in `localPrefs` (`spacy:sync:device`).
- **Schema guard:** a remote board whose `schemaVersion` is newer than this app's is not opened or merged. The board is marked "Needs a newer version of the app" and its sync pauses (the `NewerSchemaError` path).
- **Schedule:** a cycle runs on start, 3 s after the last local change to a board (debounced), on `online`, when the tab becomes visible, and every 60 s while visible. Failures back off exponentially (up to 5 min).

## Tasks
1. `RemoteStore`, `MemoryRemoteStore`, the `REMOTE_SYNC` origin.
2. `SyncEngine` (`storage/sync/engine.ts`, pure TS): the per-board cycle (download → apply → upload delta → record `syncedSV`), compaction, cursor and `syncedSV` persistence (a new `sync` store in the `spacy` IndexedDB, DB version 2), backoff and schedule hooks.
3. Leader election and the tab-channel broadcast of applied remote updates.
4. Hook into `openBoard`: an open board's doc reports local changes to the engine (debounce) and receives remote updates live.
5. `SyncStatus` (plain state the UI will read in step 50): `off | syncing | synced(at) | offline | error(reason)` per board and overall.

## Tests
- `engine.test.ts` with two or three simulated devices (separate fake-indexeddb databases, one `MemoryRemoteStore`):
  - edits on A appear on B; concurrent edits merge
  - offline edits upload after reconnect
  - a failed upload is retried and loses nothing
  - compaction while another device uploads keeps everything
  - a newer schema pauses that board
  - remote updates never enter the undo stack
- Leader election: two engines on one "browser" sync once.

## Acceptance criteria
- [x] `pnpm verify` passes
- [x] `00-architecture.md`: the non-goal lifted, §14 Sync (file layout, state-vector upload, compaction, leader tab, origins), §6 the `sync` store

## Out of scope
The board list (step 48), images (step 49), Google Drive and UI (step 50).

## Commit
`feat(sync): storage-agnostic sync engine for boards`
