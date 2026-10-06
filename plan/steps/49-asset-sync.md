# Step 49 — Image sync

Phase: L. Sync · Depends on: 48 · Estimate: 1 day

## Goal
Images on a board show up on the user's other devices, without downloading every image of every board up front.

## Design
- Asset ids are random and an asset never changes after it's stored, so each one is uploaded **once**. Files are `kind=asset, asset=<id>, board=<boardId>, mime, w, h`. No merging is needed.
- **Upload:** after a sync cycle, assets in the local `assets` store that aren't known remotely are uploaded (a queue persisted in the `sync` store, so a large image interrupted mid-upload resumes on the next cycle).
- **Download on demand:** when a board renders an image whose asset is missing locally, the asset cache asks the engine for it. The image shows a placeholder ("Downloading…") until then. Exports and thumbnails wait for missing assets with a timeout.
- **Clean-up:** a purged board's remote assets are deleted with its files. The existing local `gcAssets` stays local; remote orphans (an image deleted from a board) are removed when the board is compacted.
- **Size limits:** above 20 MB per image the upload is skipped and the image stays on this device. It's shown with a "Not synced (too large)" note in the image's context menu.

## Tasks
1. The asset upload queue and remote asset index.
2. On-demand download through `AssetUrlCache` (board) and the export and thumbnail paths.
3. Remote clean-up on purge and compaction.
4. The placeholder and "not synced" states for images.

## Tests
- `assets.test.ts`:
  - an image added on A appears on B when B opens the board
  - an interrupted upload resumes
  - purge deletes remote assets
  - a too-large image is skipped and flagged
- e2e (with the in-memory store exposed through test hooks): an image on device A renders on device B after its placeholder.

## Acceptance criteria
- [ ] `pnpm verify` and `pnpm test:e2e` pass

## Out of scope
Google Drive and UI (step 50).

## Commit
`feat(sync): sync images on demand`
