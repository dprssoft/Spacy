# Step 36 — Rich media controls

Phase: I. Extensions · Depends on: 35 · Estimate: 2.5 days

## Goal
Every media element, whether YouTube, Vimeo or an audio/video file, gets the same set of controls of our own. They have a constant on-screen size at any zoom and offer play/pause, seeking with a preview, skip, volume, speed, loop, clip start/end, fullscreen, picture-in-picture and keyboard shortcuts. Clip and loop settings are saved with the board; volume and speed are personal.

## Read first
- Step 35 and its PROGRESS entry; `src/lib/board/media/*`, `elements/media/MediaView.svelte`
- `00-architecture.md` D5 (screen-space overlay), D6, §11 (shortcuts)
- `src/lib/board/canvas/SelectionOverlay.svelte` (screen-space positioning), `src/lib/shared/localPrefs.ts`
- YouTube IFrame Player API (postMessage protocol) and Vimeo Player API (postMessage protocol) docs

## Design
- **One controller interface, three adapters** (`board/media/controller.ts`, no Svelte):
  ```ts
  interface MediaController {
    readonly state: { playing: boolean; time: number; duration: number; buffered: number /* 0..1 */;
                      volume: number /* 0..1 */; muted: boolean; rate: number; ready: boolean;
                      error: string | null };
    readonly can: { rate: boolean; pip: boolean; captions: boolean };
    play(): void; pause(): void; seek(seconds: number): void;
    setVolume(v: number): void; setMuted(m: boolean): void; setRate(r: number): void;
    subscribe(fn: () => void): () => void; destroy(): void;
  }
  ```
  - `NativeController`: wraps the `<video>`/`<audio>` element (`timeupdate`, `progress`, `durationchange`, `ratechange`, `volumechange`; PiP and text tracks where available).
  - `YouTubeController`: talks to the iframe over `postMessage` (`enablejsapi=1&origin=<location.origin>&controls=0&playsinline=1`): sends `listening`, then `command` messages (`playVideo`, `pauseVideo`, `seekTo`, `setVolume`, `mute`/`unMute`, `setPlaybackRate`); reads `onReady`, `infoDelivery` (time, duration, state, volume, rate, loaded fraction) and `onError`.
  - `VimeoController`: Vimeo's `postMessage` methods (`play`, `pause`, `setCurrentTime`, `setVolume`, `setPlaybackRate`, `addEventListener` for `timeupdate`/`progress`/`play`/`pause`/`ended`/`volumechange`/`playbackratechange`/`error`).
  - **No third-party script runs in our page** (no IFrame API loader, no Vimeo SDK), so `script-src` stays `'self'`. Messages are accepted only when `event.source` is that iframe's window and `event.origin` is the provider's origin; malformed data is ignored.
  - **Fallback:** if a provider doesn't answer the handshake within 4 s, reload its iframe with the provider's own controls and hide ours ("Using the player's controls").
- **Clip and loop** (stored on the element: `start`, `end`, `loop` from step 35's model): playback begins at `start`. On reaching `end` (or the end of the media) it stops there, or jumps back to `start` when `loop` is on. The adapters enforce this from time updates, so it works the same everywhere.
- **Personal settings** (`localPrefs` `smthng:media` = `{ volume, muted, rate }`): applied to every player when it starts. They're never written to the board.
- **One player at a time**: starting playback pauses any other playing media on the board (a setting, on by default).

## Tasks
1. Controller interface, the three adapters and a `createController(el, node)` factory. `PlaybackState` (step 35) holds a controller per playing id.
2. **Controls bar** (`board/media/MediaControls.svelte` + small parts, each < 250 lines), rendered in the **screen-space overlay** under (or, when there's no room, over) the media element's screen rect, so it's the same size at any zoom. It shows while the element is playing and hovered, selected or being interacted with, and fades 2 s after the pointer leaves. Parts:
   - play/pause; back 10 s / forward 10 s
   - scrubber: progress, buffered range, clip start/end markers (dimmed outside the clip), a hover time preview, drag to seek (one seek per frame while dragging)
   - time "1:23 / 4:56" (switching to remaining time on click)
   - volume: mute button + slider (vertical popover)
   - speed menu: 0.5×, 0.75×, 1×, 1.25×, 1.5×, 2× (hidden when `can.rate` is false)
   - "More" menu: Loop (toggle), Set start here, Set end here, Clear clip, Captions (native tracks only), Picture-in-picture (native video only), Open link, Copy link (with `?t=` at the current time)
   - fullscreen: the media wrapper goes fullscreen and the same controls bar mounts inside it (the overlay isn't visible in fullscreen)
   - compact layout when the element is under 280 px wide on screen: play/pause, time and "More" only; audio elements always show a single-row bar.
3. **Writes**: Loop, Set start/end and Clear clip go through `updateElement` (LOCAL, one undo step each). Values are clamped (`0 ≤ start < end ≤ duration`).
4. **Keyboard** while a media element is selected or being interacted with (and no text field has focus): Space/K play-pause, J/L ∓10 s, ←/→ ∓5 s, ↑/↓ volume ±5 %, M mute, F fullscreen, Shift+, / Shift+. speed down/up, 0–9 jump to 0–90 %, Home/End clip start/end, Shift+L loop. Add them to the shortcuts help (§11) and make sure they don't fire canvas shortcuts.
5. **Accessibility**: every control is a button or slider with a label; the scrubber is `role="slider"` with `aria-valuetext="1:23 of 4:56"`; the bar is reachable with Tab from the selected element; state changes are announced politely ("Playing", "Paused", "Loop on").
6. Poster (step 35) shows the clip ("0:30–1:10") and a loop badge when set.

## Files
- create: `src/lib/board/media/{controller.ts, native.ts, youtube.ts, vimeo.ts, clip.ts, mediaPrefs.ts}` and tests; `src/lib/board/media/MediaControls.svelte` (+ `Scrubber.svelte`, `VolumeControl.svelte`, `MediaMoreMenu.svelte`)
- modify: `elements/media/MediaView.svelte`, `media/playback.svelte.ts`, `canvas/SelectionOverlay.svelte` or a new `MediaOverlay.svelte` in the overlay snippet, shortcuts registry and help, `00-architecture.md` (§9 media controller, §11 shortcuts)

## Tests
- `clip.test.ts` (pure): stop/loop decisions at `end`, at the media end, with `end` past the duration, with `start` past `end` (clamped).
- `youtube.test.ts` / `vimeo.test.ts`: with a fake iframe window: handshake → ready; commands produce the right messages; `infoDelivery` / events update state; messages from another source or origin are ignored; no answer within 4 s → fallback flag.
- `native.test.ts`: state follows media element events (jsdom `HTMLMediaElement` with stubbed `play`/`pause`).
- e2e `media-controls.spec.ts`, network-free: a local `.webm` fixture for native playback. For YouTube and Vimeo, `page.route` serves small fake player pages (`tests/e2e/fixtures/fake-youtube.html`, `fake-vimeo.html`) that speak the subset of the postMessage protocol we use.
  - play/pause/seek by clicking the scrubber; time display updates
  - Set start / Set end / Loop → the clip markers show, playback loops; undo restores the previous clip
  - volume and speed survive a reload (personal prefs) but aren't in the exported `.smthng`
  - starting a second media pauses the first
  - keyboard: Space, ←/→, M while selected; Space in a doc card still types a space
  - controls keep the same pixel size at 25 % and 200 % zoom
  - the fake YouTube page that never answers → the fallback with the provider's controls
- axe check on the controls bar.

## Acceptance criteria
- [x] `pnpm verify` and `pnpm test:e2e` pass
- [x] The same controls and shortcuts work for YouTube, Vimeo, video and audio
- [x] No third-party script loads in the app's page; CSP unchanged from step 35
- [x] Controls are usable with the keyboard only and pass axe

## Out of scope
YouTube/Vimeo captions and quality selection (their own controls in fallback mode cover them), chapters, synced playback between tabs, playlists, waveform display, local media files.

## Notes
- Vimeo can hide its own controls only for videos whose owner's plan allows it; otherwise both bars show. Vimeo's speed control also depends on the owner's plan: the speed menu hides when `setPlaybackRate` fails.
- YouTube's postMessage protocol is what the official IFrame API uses under the hood; if it changes, the fallback keeps media playable.

## Commit
`feat(media): add rich play controls with clips, loop, speed, fullscreen and shortcuts`
