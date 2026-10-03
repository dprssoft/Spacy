# Step 36 — Local media files (optional)

Phase: I. Extensions · Depends on: 35 · Estimate: 1 day

> **Needs the human's approval before starting:** adds an optional `assetId` to media elements and lets large files into board assets and `.smthng` exports. Decide the size limit and whether exports include media (see task 4).

## Goal
Drop an `.mp4`, `.webm`, `.mp3`, `.wav`, `.ogg` or `.m4a` file on the board and it becomes a media element that plays offline from IndexedDB, like images do.

## Read first
- Step 35, `src/lib/storage/{assetsRepo.ts, fileFormat.ts}`, `src/lib/board/images/{importImages.ts, assetUrls.ts}`, `src/lib/board/files/importFiles.ts`

## Proposed data model change (for approval)
`MediaElement` gains `assetId: string | null` (null for links). When set, `url` is empty and `provider` is `'video'` or `'audio'`. Schema version 6 (an app on version 5 would show a link-less poster that can't play).

## Tasks
1. Accept the media MIME types/extensions in `fileKinds.ts`; `importFiles` routes them to `importMediaFiles` (stores the blob with `assetsRepo.put`, reads duration and video size from a detached `<video>` element to size the box).
2. `MediaView` plays assets through `AssetUrlCache` (blob URLs), so it works offline.
3. Limit: 200 MB per file (toast above it). Asset cleanup, duplication and import already walk all elements with `assetId`; extend their type checks to media.
4. `.smthng` export: include media assets by default, with a checkbox in the export dialog "Include audio and video files (N MB)"; when excluded, the media element keeps its title and shows "Media file not included" on import.
5. Backup reminder text mentions that media makes backups large.

## Tests
- Unit: import stores one asset and sizes the box from the video's dimensions; files over the limit are rejected; export with and without media; import of a file without media shows the missing state.
- e2e: drop the fixture `.webm` → plays; reload → still plays offline (`context.setOffline(true)`).

## Acceptance criteria
- [ ] `pnpm verify` and `pnpm test:e2e` pass
- [ ] A dropped video plays after a reload with the network off
- [ ] `00-architecture.md` §5, §6 and §10 updated

## Out of scope
Transcoding, trimming, streaming very large files, waveform previews.

## Commit
`feat(media): play audio and video files stored on the board`
