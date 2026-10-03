# Step 38 — Touch editing

Phase: J. Mobile · Depends on: 37 · Estimate: 1.5 days

## Goal
Everything you can edit with a mouse and keyboard can be edited on a phone or tablet: a long-press context menu, styling in a bottom sheet, text and doc card editing that stays visible above the on-screen keyboard, drawing with finger or stylus, and media controls sized for touch.

## Read first
- Step 37 and its PROGRESS entry; `src/lib/shared/layout.svelte.ts`
- `src/lib/board/ui/CanvasContextMenu.svelte`, `src/lib/board/style/StylePopover.svelte` and `style/controls/*`, `src/lib/board/elements/TextEditor.svelte`, `src/lib/board/elements/doccard/DocCardView.svelte`, `src/lib/board/doccards/{DocRibbon.svelte, FocusMode.svelte}`, `src/lib/board/media/MediaControls.svelte`, `src/lib/board/tools/{pen, sketch, eraser}*`

## Tasks
1. **Long-press menu:** a long-press (500 ms, < 8 px) on an element selects it and opens the canvas context menu at the finger (iOS Safari fires no `contextmenu`; Android's is ignored so it doesn't open twice). On empty canvas the long-press keeps starting a marquee (step 37); a long-press without moving opens the empty-canvas menu (Paste, Select all, Zoom to fit). Menus get 44 px rows on coarse pointers.
2. **Style bottom sheet:** on compact screens the style popover becomes a bar docked above the bottom toolbar; its panels (fill, stroke, text, arrange, quick styles…) open as a **bottom sheet** (bits-ui Dialog, drag handle, swipe down to close, max 60 % of the height, scrollable) instead of floating popovers. Desktop and tablets keep the popover.
3. **On-screen keyboard:** while text or a doc card is being edited, follow `window.visualViewport`: pan the board so the edited element (the caret's line for doc cards) stays above the keyboard; the bottom toolbar hides and the doc formatting ribbon docks just above the keyboard as one scrollable row. On phones, editing a doc card body offers "Open full screen" (focus mode), which uses the whole screen above the keyboard.
4. **Drawing:** pen, sketch and eraser work with one finger; a stylus adds pressure (already used) and **palm rejection**: while a pen pointer is down or was used in the last second, touch pointers on the canvas are ignored for drawing tools (two-finger pinch still works).
5. **Selection on touch:** handles keep 44 px hit areas; the rotate handle sits further out on coarse pointers; connector endpoint and bend handles likewise; the quick-create "+" buttons become larger and only show for a single selection.
6. **Media on touch:** the controls bar uses touch sizes (compact layout by default on phones), the volume control becomes a horizontal slider, tapping the video while in use toggles play, and the bar doesn't hide on a timer while the element is selected.
7. **Text selection inside text editors** must not pan the board: while editing, one-finger drags inside the editor are left to the browser.

## Tests
- Unit: long-press vs drag vs pinch arbitration; palm rejection (pen down → touch ignored for draw tools, not for pinch); keeping a rect above a viewport bottom (pure).
- `tests/e2e/mobile-editing.spec.ts` (mobile project):
  - long-press a sticky → menu → Duplicate; long-press empty canvas (no move) → menu with Paste.
  - select a shape → style bar → Fill → bottom sheet → pick a color → applied; swipe down closes it.
  - double-tap a sticky, type → text saved; the sticky is within the visual viewport (simulate a smaller `visualViewport` height via a test hook).
  - draw a pen stroke with one finger; with a pen pointer down, a touch drag draws nothing.
  - paste a media link, double-tap → controls ≥ 44 px, play/pause by tap.
- axe on the bottom sheet and the compact bars.

## Acceptance criteria
- [x] `pnpm verify` and `pnpm test:e2e` (chromium + mobile) pass
- [x] Every desktop editing action has a touch path (checked against the shortcuts list and context menu)
- [x] Screenshots of editing on phone size (sheet open, keyboard-sized viewport, media controls) reviewed
- [x] `00-architecture.md` §8 (touch input) and §11 (gestures) updated

## Out of scope
Native apps, offline sync between devices, Apple Pencil hover, haptics.

## Commit
`feat(mobile): touch editing: long-press menu, style sheet, keyboard-aware editing, palm rejection`
