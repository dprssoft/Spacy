# Step 37 — Mobile layout and touch navigation

Phase: J. Mobile · Depends on: 36 · Estimate: 1.5 days

## Goal
On a phone (360–430 px wide) the start page and the board fit the screen without sideways scrolling, every control is reachable and at least 44 × 44 px, and the board can be navigated with fingers: one finger pans, two fingers pinch, tap selects, double-tap edits or plays. Tablets and desktop keep their current layout.

## Read first
- `00-architecture.md` §1 (non-goals: mobile editing is now in scope), §8, §11
- `src/lib/board/{TopBar.svelte, ui/Toolbar.svelte, ui/StatusBar.svelte, ui/PageTabs.svelte, ui/ZoomControls.svelte}`, `src/lib/home/{HomeHeader.svelte, HomePage.svelte, GridToolbar.svelte}`
- `src/lib/board/canvas/viewportInput.ts`, `src/lib/board/tools/{pointerRouter.ts, select.svelte.ts}`
- `src/app.html`, `src/app.css`

## Design
- **One breakpoint:** compact = `max-width: 639px` (Tailwind `sm`), plus `(pointer: coarse)` for target sizes. `src/lib/shared/layout.svelte.ts` exposes `layout.compact` and `layout.coarse` (matchMedia, reactive).
- **Board on compact screens:** top bar = back, title (truncates), undo/redo, "⋯" menu (Export, Present, Settings, Help); the saved status becomes an icon with a label for screen readers. The toolbar moves to the **bottom** (thumb reach) as one row: Select, Hand, Pen, Shapes, Sticky, Text, and "+ Insert" (doc card, frame, connector, image, media, templates, sketch, eraser). Contextual ribbons (doc formatting, sketch) open as a second row above it. Page tabs and zoom go into a slim strip above the toolbar.
- **Start page on compact screens:** search collapses to an icon that expands over the header; the section nav (Recent, Starred, All boards, Trash) becomes a full-width segmented control that scrolls with a fade hint; grid/list toggle stays.
- **Touch gestures** (canvas, `pointerType === 'touch'`):
  - one finger on empty canvas: pan (with Select or Hand). On an element: select and move, as with a mouse.
  - **Long-press (500 ms, < 8 px movement) on empty canvas:** marquee selection from that point.
  - Two fingers: pinch-zoom and pan. When the second finger lands, the first finger's tool gesture is **cancelled** (`tool.onCancel()`, no write), so a pinch never moves or selects anything.
  - Double-tap (two taps < 300 ms, < 16 px apart): the same as a double-click (edit text, play media, enter group).
  - Tap on empty canvas: clear selection.
  - Stylus (`pointerType === 'pen'`) behaves like a mouse; drawing tools ignore touch while a stylus is down (palm rejection).
- **Safe areas:** `viewport-fit=cover` and `env(safe-area-inset-*)` padding on the top bar and bottom toolbar. Inputs use ≥ 16 px text on coarse pointers (no iOS zoom-on-focus).

## Tasks
1. `layout.svelte.ts` (+ test with a mocked `matchMedia`).
2. Compact board chrome: `TopBar` (overflow menu), `Toolbar` (bottom bar, "+ Insert" menu, contextual row), `StatusBar` (page tabs + zoom strip). Keep every action reachable; keep the desktop layout unchanged.
3. Compact start page: `HomeHeader` (collapsing search), section nav, card grid spacing.
4. Coarse targets: a `touch` size variant in `ui/ribbon.ts` and shared button classes (min 44 × 44 under `(pointer: coarse)`); selection handles already grow (keep, check rotate/bend/endpoint handles too).
5. Touch gestures in `pointerRouter.ts` / `viewportInput.ts` / the select tool: one-finger pan on empty canvas, long-press marquee, pinch cancels the tool gesture, double-tap.
6. `app.html` viewport meta and safe-area CSS.
7. Playwright project **`mobile`** (Chromium with the Pixel 7 descriptor: `hasTouch`, `isMobile`), matching `tests/e2e/mobile-*.spec.ts`; `pnpm test:e2e` runs `--project=chromium --project=mobile`.

## Tests
- Unit: gesture recognizers (tap, double-tap, long-press, pan threshold) as pure functions over pointer samples; `layout` state.
- `tests/e2e/mobile-layout.spec.ts` (mobile project, 360 and 412 px): no horizontal overflow on the start page, a board and the template gallery; every top-bar and toolbar action is reachable (visible or in a menu); primary controls are ≥ 44 × 44; the board title shows at least 8 characters.
- `tests/e2e/mobile-gestures.spec.ts` (touch events via CDP `Input.dispatchTouchEvent`): one-finger drag on empty canvas pans; on a sticky it moves it; a pinch zooms and moves nothing; long-press-drag makes a marquee selection; double-tap a sticky edits it; tap empty clears the selection.
- Desktop e2e suite unchanged and green; visual baselines unchanged on desktop.

## Acceptance criteria
- [ ] `pnpm verify` and `pnpm test:e2e` (chromium + mobile) pass
- [ ] Screenshots at 360, 390 and 412 px (light and dark) of the start page, a board and the gallery reviewed and noted in PROGRESS
- [ ] Desktop layout and behaviour unchanged

## Out of scope
Touch editing UI (step 38): context menu, style sheet, keyboard handling, media controls on touch.

## Commit
`feat(mobile): fit the start page and board to phones; one-finger pan, pinch, long-press marquee and double-tap`
