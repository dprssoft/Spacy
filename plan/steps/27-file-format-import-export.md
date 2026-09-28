# Step 27 — `.smthng` files: export, import, backup

Phase: G. Sharing · Depends on: 26 · Estimate: 1.5 days

## Goal
Share and back up boards as files: export one board or all boards, and import through a button, drag-drop onto the start page, or (in Chromium) "Save to file…". Imports always create new boards.

## Read first
- `00-architecture.md` §10 (file format, exact)
- `src/lib/storage/{boardDoc.ts, assetsRepo.ts, boardsRepo.ts}`, `src/lib/shared/base64.ts`

## Tasks
1. **Format module** `src/lib/storage/fileFormat.ts`:
   - Zod schemas for `SmthngFile` (both kinds), exactly per §10.
   - `exportBoardPayload(id): Promise<BoardPayload>` (meta title/createdAt, `loadSnapshot` → base64, assets → base64 via `Blob.arrayBuffer()`).
   - `exportBoardFile(id): Promise<Blob>` (`application/json`, pretty-printed: no, compact).
   - `exportBackup(): Promise<Blob>` (all non-trashed boards). On success set `localPrefs` `lastBackupAt = Date.now()`.
   - `parseSmthngFile(text: string): SmthngFile` (throws `InvalidFileError` with a user-friendly message; a newer `version` → "This file was created with a newer version of SMTHNG.").
   - `importPayload(p: BoardPayload): Promise<BoardMeta>`:
     1. `boardsRepo.create({ title: p.title })` (keep `createdAt` from the payload)
     2. put each asset with a new id → map old → new
     3. apply the doc update to a temp `Y.Doc` (origin `IMPORT`) → run `migrate` → remap `assetId`s of image elements → set `meta.title`
     4. validate every element with `parseElement`; drop invalid ones and count them
     5. `writeSnapshot(newId, encodeStateAsUpdate(temp))`
     6. return the meta (and a warning count)
   - `importFile(file: File): Promise<{ boards: BoardMeta[]; warnings: string[] }>`: size guard (reject over 500 MB, confirm over 100 MB), then parse and import each payload **sequentially**.
2. **Start page UI**
   - The header Import button (enable it) → a hidden `<input type="file" accept=".smthng,application/json" multiple>` → `importFile` for each → toast "Imported N boards" (with an "Open" action if 1).
   - **Drop zone:** dragging files over HomePage shows a full-page overlay "Drop .smthng files to import"; the drop imports them.
   - The card menu "Export" is enabled → `exportBoardFile` → `downloadBlob(blob, slug(title) + '.smthng')`.
   - Sidebar bottom: "Backup all boards" button → `exportBackup` → `smthng-backup-YYYY-MM-DD.smthng`.
3. **Board UI:** the TopBar Export menu "Download .smthng" is enabled. If `'showSaveFilePicker' in window`: also "Save to file…" → `showSaveFilePicker({ suggestedName, types: [{ description: 'SMTHNG board', accept: { 'application/json': ['.smthng'] } }] })` → write. Keep the handle in memory for the session; "Save to file" again rewrites the same file without prompting (label it "Save to {filename}"). Guard `AbortError` (user cancelled) silently.
4. Import error handling: an invalid JSON or schema → toast error "Couldn't import {file.name}: {reason}". Partial success in a backup → import the valid boards and report the failures.

## Files
- create: `src/lib/storage/fileFormat.ts`, `src/lib/home/{ImportButton.svelte, DropZone.svelte, BackupButton.svelte}`
- modify: `HomeHeader.svelte`, `HomePage.svelte`, `Sidebar.svelte`, `BoardCardMenu.svelte`, `TopBar.svelte`

## Tests
- `fileFormat.test.ts` (fake-indexeddb):
  - Round trip: create a board with every element type, one image asset and a doc card with text → `exportBoardFile` → `importFile` → a new board id; element count equal; image `assetId` remapped and the asset blob exists with the same size; doc card text equal; title equal.
  - A backup with 3 boards imports 3 boards.
  - Rejects a wrong `format`, a newer `version`, malformed base64, and non-JSON.
  - An invalid element inside an otherwise valid file → dropped with a warning.
- `tests/e2e/files.spec.ts`: create a board with a sticky "Exported" → export from the card menu (capture the download) → delete the board forever → import the downloaded file via the Import button → a board with the same title appears and opening it shows "Exported".

## Acceptance criteria
- [ ] `pnpm verify` and `pnpm test:e2e` pass
- [ ] A file exported in Chrome imports correctly in Firefox (manual)
- [ ] An import never overwrites existing boards

## Out of scope
Importing draw.io/Excalidraw/Miro files (not planned). File handler registration (step 29).

## Commit
`feat(files): add .smthng board export/import and full backup`
