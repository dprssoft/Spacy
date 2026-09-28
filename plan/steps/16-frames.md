# Step 16 — Frames

Phase: C. Canvas · Depends on: 15 · Estimate: 1 day

## Goal
Frames that group content spatially: they're drawn beneath other elements, adopt elements placed fully inside, move their children, have an editable title, and can be navigated from the zoom menu. **Milestone M2.**

## Read first
- `00-architecture.md` §1 (non-goals: no clipping, no nested frames), §5 (frame rules)
- `src/lib/board/tools/select.ts`, `src/lib/board/canvas/ElementsLayer.svelte`

## Tasks
1. `src/lib/board/elements/frame/`:
   - `FrameView.svelte`: a rect with the fill (semi), stroke and radius from the style; a title label **above** the top-left corner (outside the box, `-translate-y-full`, `text-sm text-muted`, font size constant in world units: 14 px).
   - `definition.ts`: `hitTest` → true only on the border band (`tol + 8 / zoom`, pass the zoom through `tol`) or the title label rect (approximate width with `title.length * 8 + 16`, height 24 above the box). Clicks on the empty interior fall through to the canvas (marquee). `rotatable: false`.
2. **Frame tool** `tools/frame.ts` (F): drag to draw (click = the default 800×600 centered on the pointer); on creation, adopt elements fully inside (below).
3. **Membership** `src/lib/board/engine/frames.ts`:
   - `frameFor(el: Element, frames: FrameElement[]): string | null` → the topmost (by z) frame whose rect fully contains `aabb(el)`; frames never get a parent.
   - `recomputeParents(ctx, ids: string[])` → `updateElements` with the changed `parentId`s (same undo step as the gesture: call it before `flush` at gesture end, inside the capture window).
   - Call it at the end of: create (all tools), move, resize, paste, duplicate. When a frame is moved or resized, recompute for all elements intersecting its old and new rects.
4. **Moving a frame moves its children:** in the select tool, when the drag set contains a frame, add its children (`parentId === frame.id`, unlocked) to the drag set.
5. **Deleting a frame deletes its children** (documented choice; undo restores them). Implement as a `beforeDeleteHooks` extension that adds the children to the deletion set, or expand the ids in `deleteSelection`. Prefer expanding in `deleteSelection` plus the eraser, and keep the model hook for connectors.
6. **Marquee:** frames are selected only if fully contained by the marquee.
7. **Title editing:** double-click the title label → an inline input (reuse the `TextEditor` pattern or `InlineEditable`) → `updateElement(title)`. New frames get the title "Frame N" (N = the number of frames + 1).
8. **Zoom menu:** add a "Frames" section listing frame titles → `viewport.animateTo(fitRect(frame, size, 64, 2))`.
9. **Layering:** `ElementsLayer` already renders `frameOrder` first; make sure z-order commands on frames only reorder among frames.
10. Enable the Frame toolbar button.

## Files
- create: `src/lib/board/elements/frame/*`, `src/lib/board/tools/frame.ts`, `src/lib/board/engine/frames.ts`
- modify: `select.ts`, all creation tools, `commands/{delete,duplicate,clipboard,zorder}.ts`, `eraser.ts`, `ZoomControls.svelte`, `elements/index.ts`, `Toolbar.svelte`

## Tests
- `frames.test.ts`: `frameFor` picks the topmost containing frame, returns null for partial overlap, and frames get no parent.
- `frame/definition.test.ts`: hit on the border and title, miss in the interior.
- `tests/e2e/frames.spec.ts`: draw a frame → add a sticky inside → drag the frame by its title → the sticky moved by the same delta; drag the sticky out → dragging the frame no longer moves it; delete the frame → the sticky inside is also deleted → Mod+Z restores both.

## Acceptance criteria
- [ ] `pnpm verify` and `pnpm test:e2e` pass
- [ ] Clicking inside an empty frame starts a marquee (it doesn't select the frame)
- [ ] **M2 demo:** a usable whiteboard (manual walkthrough noted in PROGRESS)

## Out of scope
Clipping, nested frames, presenter mode.

## Commit
`feat(canvas): add frames with membership, child moving and navigation`
