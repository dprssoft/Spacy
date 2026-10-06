# Step 35 — Media element (play links on the board)

Phase: I. Extensions · Depends on: 31 · Estimate: 2.5 days

The player here uses the providers' and the browser's built-in controls; step 36 replaces them with our own.

> **Needs the human's approval before starting:** this adds an element type, bumps the schema version and widens the Content-Security-Policy. When approved, update `00-architecture.md` (§1 summary, §5 types and rules, §6 CSP note, §9 registry list) in the same commit.

## Goal
Paste or type a link to a YouTube or Vimeo video, or to an audio/video file, and it becomes a media object on the board that plays in place. It can be moved, resized, connected and exported like anything else. Nothing is fetched from a third party until you press play.

## Read first
- `00-architecture.md` §5, §8 (D4, D6), §9
- `src/lib/model/{types.ts, schema.ts, migrations.ts, defaults.ts}`, `src/lib/board/elements/registry.ts`, `src/lib/board/elements/image/ImageView.svelte`
- `src/lib/board/canvas/ElementsLayer.svelte` (culling, `show`), `src/lib/board/render/{staticSvg.ts, canvasScene.ts}`
- `src/lib/board/commands/clipboard.ts` (`pasteText`), `src/lib/board/files/importFiles.ts`, `static/_headers`

## Proposed data model (for approval)
```ts
export type MediaProvider = 'youtube' | 'vimeo' | 'video' | 'audio';
export interface MediaElement extends BaseElement {
  type: 'media';
  url: string;              // what the user entered (https only), shown and exported
  provider: MediaProvider;  // parsed once from the URL when created
  mediaId: string | null;   // provider video id (youtube/vimeo); null for files
  start: number;            // seconds, from ?t= / #t= (0 = start)
  end: number | null;       // seconds; play only up to here (a clip). null = to the end (used by step 36)
  loop: boolean;            // restart at `start` when reaching `end` or the end (used by step 36)
  title: string;            // label on the poster; defaults to the host + id or file name
}
```
- `ElementType` gains `'media'`; schema version 5 (no data moves). `end` and `loop` are part of the type from the start (defaults `null` / `false`), so step 36's controls need no second bump. The bump keeps older apps from opening boards with media: they would drop the elements they can't parse from their view, and a later edit (e.g. deleting a frame) could leave them orphaned.
- No new Y.Doc maps, no assets, no file format change (`.spacy` carries the element like any other).

## Tasks
1. **Model**: the type, the zod schema (url must be `https:`, max 2,048 chars; title max 200), `DEFAULT_SIZES.media` (video 480 × 270, audio 360 × 72), `baseStyleFor('media')` (radius sm, shadow on, no stroke), migration to version 5.
2. **URL parsing** (`board/media/parseMediaUrl.ts`, pure): returns `{ provider, mediaId, start, title }` or null.
   - YouTube: `youtube.com/watch?v=`, `youtu.be/`, `/shorts/`, `/embed/`, `/live/`; `t=1m30s` / `t=90` / `start=`.
   - Vimeo: `vimeo.com/<id>`, `player.vimeo.com/video/<id>`, `#t=`.
   - Files by extension: `.mp4 .webm .ogv .mov` → video; `.mp3 .ogg .oga .wav .m4a .aac .flac .opus` → audio.
   - Anything else: null.
   Embed URLs are built from `mediaId` only (never from the stored `url`): `https://www.youtube-nocookie.com/embed/<id>?start=<s>&autoplay=1&rel=0`, `https://player.vimeo.com/video/<id>?dnt=1&autoplay=1#t=<s>s`.
3. **View** (`elements/media/MediaView.svelte`, registered with box connectable, `keepAspect` for video, resizable, rotatable false):
   - **Poster** (default): a dark card with a provider glyph, the title, the host name and a big play button. No network request.
   - **Playing**: double-click (or Enter with it selected, or "Play" in the style popover or the context menu) swaps the poster for the player: an `<iframe>` (YouTube/Vimeo, `allow="autoplay; fullscreen; picture-in-picture; encrypted-media"`, `referrerpolicy="strict-origin-when-cross-origin"`, `sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"`) or a native `<video controls>` / `<audio controls>`.
   - While playing, the element is "interactive" like an edited doc card: its wrapper takes pointer events, so the player's own controls work. Escape or a click elsewhere leaves interaction, but **playback continues**; "Stop" (style popover or context menu) (or deleting the element) returns it to the poster.
   - `PlaybackState` (`board/media/playback.svelte.ts`, in the board context): the set of playing ids. `ElementsLayer` keeps playing elements mounted when culled or when the scene canvas is shown (like selected ones), so scrolling away doesn't cut the sound. Switching page or closing the board stops everything.
   - Offline (`navigator.onLine === false`) with an embed: the poster says "Offline: can't play" and the play button is disabled. File URLs try anyway and show "Can't play this file" on error.
4. **Creating media**:
   - Paste: `pasteText` checks `parseMediaUrl` first; a supported link becomes a media element at the paste anchor (other text keeps today's behaviour).
   - Drop: a dragged link (`text/uri-list` or a plain-text URL) on the canvas creates one at the drop point (`importFiles` grows a "links" branch).
   - Insert → "Media" in the toolbar: a small popover with a URL field, validation message ("Paste a YouTube, Vimeo, audio or video link") and Add.
5. **Other surfaces**:
   - Scene canvas (`canvasScene.ts`) and static SVG/PNG export (`staticSvg.ts`): draw the poster (card, play triangle, title). Thumbnails likewise.
   - Markdown export of a doc card mentioning a media element: `[title](url)`. Mentions list media by title.
   - Style popover: radius and shadow, plus Play/Stop. Context menu (`CanvasContextMenu`): Play/Stop, "Open link" (new tab, `noopener`), "Copy link".
   - Hit testing: the box. Connectable: the default box.
6. **Security policy** (`static/_headers`; the e2e server serves the built copy): add `frame-src https://www.youtube-nocookie.com https://player.vimeo.com; media-src 'self' blob: https:`. `connect-src` stays `'self'`: no oEmbed or thumbnail fetching. Update `csp.spec.ts` to assert exactly these sources.

## Files
- create: `src/lib/board/media/{parseMediaUrl.ts, parseMediaUrl.test.ts, playback.svelte.ts}`, `src/lib/board/elements/media/{MediaView.svelte, index.ts}`, `src/lib/board/ui/MediaLinkPopover.svelte`
- modify: `model/{types,schema,defaults,migrations}.ts`, `elements/index.ts`, `canvas/ElementsLayer.svelte`, `context.ts`, `commands/clipboard.ts`, `files/importFiles.ts`, `render/{staticSvg,canvasScene}.ts`, `ui/Toolbar.svelte`, `style/StylePopover.svelte`, `ui/CanvasContextMenu.svelte`, `static/_headers`, `00-architecture.md`

## Tests
- `parseMediaUrl.test.ts`: every URL form above, start times, rejection of `http:`, `javascript:`, unknown hosts and lookalikes (`youtube.com.evil.example`), ids with invalid characters.
- `schema.test.ts`: media element round-trips; non-https url rejected. `migrations.test.ts`: v4 → v5.
- `staticSvg.test.ts` snapshot with a media poster; `canvasScene` draws media without errors.
- e2e `media.spec.ts` (network-free: point the "video" case at a tiny `.webm` served from `tests/e2e/fixtures`, and for YouTube only assert the iframe `src` host/path without loading it — route `**/youtube-nocookie.com/**` to an empty page):
  - paste a YouTube link → a media element with the poster and no iframe; double-click → an iframe whose src is `https://www.youtube-nocookie.com/embed/<id>?…`; Escape → still playing; Stop → poster.
  - a `.webm` link plays in a `<video>`; scrolling it out of view keeps it mounted.
  - Insert → Media with an invalid link shows the message; with a valid one adds the element.
  - undo removes a pasted media element; export PNG contains it (non-empty pixels in its box).
  - `csp.spec.ts`: the new directives are present.

## Acceptance criteria
- [x] `pnpm verify` and `pnpm test:e2e` pass
- [x] No request to a third-party host happens before pressing play (checked in e2e with `page.on('request')`)
- [x] Playback survives panning, zooming and leaving interaction; stops on delete, page switch and board close
- [x] `00-architecture.md` updated (types, schema version 5, CSP)

## Out of scope
Our own play controls (step 36: this step uses the providers' and the browser's built-in controls), local media files stored on the board (dropped from the plan), thumbnails from providers, other providers (Spotify, SoundCloud, Loom), synced playback between tabs, playlists.

## Commit
`feat(media): add media elements that play YouTube, Vimeo, audio and video links in place`
