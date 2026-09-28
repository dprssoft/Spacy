# Step 12 — Creation tools and text editing

Phase: C. Canvas · Depends on: 11 · Estimate: 1.5 days

## Goal
Create rectangles, ellipses, diamonds, stickies and text by click or drag, and edit their text in place.

## Read first
- `00-architecture.md` §12 (defaults), `CLAUDE.md` code rules (rAF batching, one undo step per gesture)
- `src/lib/model/ops.ts`, `src/lib/model/defaults.ts`

## Tasks
1. `src/lib/board/tools/rafBatch.ts`: `createRafWriter<T>(apply: (latest: T) => void)` returning `{ push(v), flush(), cancel() }`. It applies at most once per animation frame with the latest value.
2. `src/lib/board/style/styleDefaults.ts`: `getDefaultStyle(type: ElementType): Style` = `baseStyleFor(type)` (step 18 adds user defaults here).
3. **Shape tool** `tools/shape.ts` (kind from `tools.shapeKind`; R/O/D set the kind and activate):
   - pointerdown: `undo.stopCapturing()`, remember the start.
   - Moving more than 3 screen px → create a shape with `w = h = 1` via `createElements`, then resize it on moves through `rafBatch` + `updateElement` (Shift → square; Alt → from center).
   - pointerup without a drag → create at the default size (160×100) centered on the pointer.
   - After creation: `selection.set([id])`, `tools.returnToSelect()`.
4. **Sticky tool** `tools/sticky.ts` (S): click → a 200×200 sticky centered on the pointer, default color yellow → select → start text editing immediately.
5. **Text tool** `tools/text.ts` (T): click → a text element (`autoWidth: true`, initial size 20×(font line height)) at the pointer → start editing. When editing ends with empty text → delete the element.
6. **Text editing overlay** `src/lib/board/elements/TextEditor.svelte`:
   - Rendered **inside** `ElementView` when `selection.editingId === id` (so world transforms apply) with `pointer-events: auto` and `data-interactive`.
   - A `<textarea>` with a transparent background, no border, no resize, font and alignment from the element's style (for shapes: centered vertically using the same flex wrapper as the view), auto-focus, caret at the end (select all when opened with Enter on existing text).
   - Writes text with `updateElement` debounced 150 ms, flushed on blur, Escape or `Mod+Enter`. Escape or `Mod+Enter` exit editing and keep the element selected. Clicking outside exits (blur).
   - Text elements with `autoWidth`: after each input, measure (a hidden mirror div with the same font, `white-space: pre`) → update `w/h` (batched with the text write).
   - While editing, the view hides its own static text (avoid double rendering).
   - Canvas shortcuts are ignored (typing target) and Delete/Backspace edit text normally.
7. **Enter editing:** the select tool's `onDoubleClick` on an element whose definition has `editableText` → `selection.editingId = id`. `Enter` with a single editable element selected → the same. Double-click on empty canvas with the select tool → create a text element there and edit it (whiteboard convenience).
8. `selection.editingId` elements are always rendered (add them to `alwaysRender`).
9. Enable the toolbar buttons for shapes, sticky and text.

## Files
- create: `src/lib/board/tools/{rafBatch.ts, shape.ts, sticky.ts, text.ts}`, `src/lib/board/style/styleDefaults.ts`, `src/lib/board/elements/TextEditor.svelte`
- modify: `ElementView.svelte`, the shape/sticky/text views, `select.ts`, `toolManager.svelte.ts`, `Toolbar.svelte`

## Tests
- `rafBatch.test.ts`: multiple pushes in one frame → one apply with the latest value (mock `requestAnimationFrame`).
- `tests/e2e/create.spec.ts`:
  - R + drag creates a rect of about the dragged size; one Mod+Z removes it (one undo step for the whole drag).
  - S + click creates a sticky in editing mode; type "Hello" → Escape → reload → the sticky shows "Hello".
  - T + click + type "Title" → click empty canvas → a text element with "Title" exists; T + click + Escape without typing → no element remains.
  - Double-click a rect → type "Box" → Escape → the rect shows "Box".

## Acceptance criteria
- [ ] `pnpm verify` and `pnpm test:e2e` pass
- [ ] Every creation gesture is exactly one undo step
- [ ] Text editing looks identical in position and font to the rendered text (no visual jump; manual check)

## Out of scope
Move, resize and rotate (step 13), styling UI (step 17).

## Commit
`feat(tools): add shape, sticky and text creation tools with in-place text editing`
