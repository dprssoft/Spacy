# Step 04 — Metadata and asset storage

Phase: A. Foundation · Depends on: 03 · Estimate: 1.5 days

## Goal
IndexedDB storage for board metadata and image assets, change notifications across tabs, persistent-storage request, and a reactive boards query for the start page.

## Read first
- `00-architecture.md` §3 (D3), §6 (IndexedDB schema, channels)

## Tasks
1. Install: `pnpm add idb`.
2. `src/lib/storage/types.ts`: `BoardMeta`, `AssetRecord` (from `00-architecture.md` §6), `BoardFilter = 'recent'|'starred'|'all'|'trash'`, `BoardSort = 'opened'|'updated'|'created'|'title'`.
3. `src/lib/storage/db.ts`: `getDB()` (memoized `openDB('spacy', 1, { upgrade })`) creating the stores and indexes from §6. Also export `resetDBForTests()`, which closes the connection and clears the memo.
4. `src/lib/storage/channels.ts`:
   - `notifyBoardsChanged()`: posts `{type:'boards-changed'}` on `BroadcastChannel('spacy-meta')` **and** dispatches on a module-level `EventTarget` (BroadcastChannel doesn't deliver to its own tab)
   - `onBoardsChanged(cb): () => void`: listens to both
   - Guard for environments without `BroadcastChannel`
5. `src/lib/storage/boardsRepo.ts`:
   ```ts
   get(id): Promise<BoardMeta | undefined>
   list(opts: { filter: BoardFilter; sort: BoardSort; query?: string }): Promise<BoardMeta[]>
   create(init?: { title?: string }): Promise<BoardMeta>   // title default 'Untitled board'; all timestamps = now
   rename(id, title): Promise<void>                        // trimmed; empty → ignored
   setStarred(id, starred): Promise<void>
   touchOpened(id): Promise<void>
   touchUpdated(id): Promise<void>
   setThumbnail(id, blob: Blob | null): Promise<void>
   setViewport(id, vp): Promise<void>
   trash(id): Promise<void>                                // deletedAt = now
   restore(id): Promise<void>
   destroy(id): Promise<void>                              // deletes meta + assets; step 05 adds doc data deletion
   purgeExpiredTrash(now = Date.now(), days = 30): Promise<string[]>  // returns destroyed ids
   ```
   - `list` filtering: recent/all = not deleted; starred = starred and not deleted; trash = deleted. Recent is always sorted by `openedAt` desc and ignores `sort`. Query = case-insensitive substring match on the title. Filter and sort in JS; the title sort uses `localeCompare` with `sensitivity: 'base'`.
   - Every mutation calls `notifyBoardsChanged()` — except `touchUpdated`, `setThumbnail` and `setViewport`, which notify through a throttle (at most once per second) so the start page doesn't thrash.
   - Use `readwrite` transactions. Mutations on a missing id are silent no-ops.
6. `src/lib/storage/assetsRepo.ts`:
   ```ts
   put(boardId, blob, dims: { width: number; height: number }): Promise<string>  // returns new asset id
   get(id): Promise<AssetRecord | undefined>
   listByBoard(boardId): Promise<AssetRecord[]>
   deleteByBoard(boardId): Promise<void>
   deleteMany(ids: string[]): Promise<void>
   copyToBoard(fromBoardId, toBoardId): Promise<Map<string, string>>  // old id -> new id
   ```
7. `src/lib/storage/persist.ts`: `requestPersistentStorage(): Promise<boolean>`, which calls `navigator.storage?.persist?.()` at most once per session and never throws. `storageEstimate(): Promise<{ usage: number; quota: number; persisted: boolean } | null>`.
8. `src/lib/home/boards.svelte.ts`:
   ```ts
   export class BoardsQuery {
     items = $state<BoardMeta[]>([]);
     loading = $state(true);
     filter = $state<BoardFilter>('recent');
     sort = $state<BoardSort>('opened');
     query = $state('');
     constructor()          // does NOT subscribe; call start()
     start(): () => void    // subscribes to onBoardsChanged + $effect.root re-running refresh when filter/sort/query change; returns cleanup
     refresh(): Promise<void>  // ignores stale responses (request counter)
   }
   ```

## Files
- create: `src/lib/storage/{types,db,channels,boardsRepo,assetsRepo,persist}.ts`, `src/lib/home/boards.svelte.ts`, tests

## Tests
Use `fake-indexeddb` (already in the setup). Call `resetDBForTests()` and `indexedDB.deleteDatabase('spacy')` in `beforeEach`.
- `boardsRepo.test.ts`: create defaults; rename trims and ignores empty; each filter; each sort; query; trash/restore; purge removes only items older than 30 days; destroy also removes assets; notifications fire (spy on `onBoardsChanged`).
- `assetsRepo.test.ts`: put/get; listByBoard; copyToBoard returns an id map and the copied blobs have equal size.
- `boards.svelte.test.ts`: `BoardsQuery.refresh` loads items; changing the filter updates items (use `flushSync` / await ticks).

## Acceptance criteria
- [x] `pnpm verify` passes
- [x] `src/lib/storage` imports nothing from `svelte` (the rune-based `BoardsQuery` lives in `src/lib/home/`)
- [x] All repository functions are covered by tests

## Out of scope
Y.Doc persistence (step 05), UI (step 06).

## Commit
`feat(storage): add IndexedDB board metadata and asset repositories`
