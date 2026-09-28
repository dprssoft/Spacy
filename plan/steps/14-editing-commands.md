# Step 14 — Editing commands

Phase: C. Canvas · Depends on: 13 · Estimate: 1.5 days

## Goal
Undo/redo, delete, duplicate, copy/cut/paste (within and across boards), z-order, lock, group/ungroup, and a canvas context menu.

## Read first
- `00-architecture.md` §3 (D10), §5 (z rules), §11
- `src/lib/model/{ops.ts, clone.ts, zorder.ts}`

## Tasks
1. `src/lib/board/commands/` exports pure-ish functions `(ctx: BoardContext, ...) => void` and registers shortcuts:
   - **`undo.ts`:** `undo(ctx)`, `redo(ctx)`; `UndoState` class (`canUndo`, `canRedo` via `$state`, updated from `stack-item-added` / `stack-item-popped` / `stack-cleared`). After undo/redo, prune the selection. Shortcuts `Mod+Z`, `Mod+Shift+Z`, `Mod+Y`. Add Undo/Redo icon buttons to `TopBar` (disabled when unavailable).
   - **`delete.ts`:** `deleteSelection(ctx)` (skips locked; goes through `deleteElements`). Keys `Delete`, `Backspace`.
   - **`duplicate.ts`:** `duplicateSelection(ctx)`: `cloneElements(selected, { offset: {x:16, y:16} })`, new z keys above the max (`zManyAbove`) keeping relative order, create, select the copies. `Mod+D`.
   - **`zorder.ts`:** `bringToFront`, `sendToBack`, `bringForward`, `sendBackward`:
     - front: `zManyAbove(maxZ, n)` in the current relative order; back: the mirror with `zBelow`.
     - forward: for each selected element (topmost first), find the next higher non-selected element that **overlaps** its AABB and place it between that element and the one after. If none overlap, do nothing.
     - Frames only reorder among frames.
     - Keys `]`, `[`, `Mod+]`, `Mod+[`.
   - **`lock.ts`:** `toggleLock` (`Mod+Shift+L`): if any selected is unlocked → lock all, else unlock all.
   - **`group.ts`:** `group` (`Mod+G`): at least 2 elements → a new `groupId` for all (replacing old ones). `ungroup` (`Mod+Shift+G`): set `groupId = null` for the selected groups.
2. **Clipboard** `src/lib/board/commands/clipboard.ts`:
   - Payload: `{ smthng: 1, sourceBoardId, elements: Element[], docs: string /* base64 Y update of a temp doc holding cloned fragments in getDocsMap */, assets: string[] }`.
   - Serialized to text: `'SMTHNG-CLIPBOARD:' + JSON.stringify(payload)`. Doc cards: `tempDoc.getMap('docs').set(id, fragment.clone())` → `encodeStateAsUpdate`. Add `src/lib/shared/base64.ts` (`bytesToBase64`, `base64ToBytes`, chunked to avoid call-stack limits) with tests.
   - **copy** (`Mod+C`): `navigator.clipboard.writeText(text)`; also keep an in-memory `lastCopied` fallback for when the clipboard API is denied.
   - **cut** (`Mod+X`) = copy + delete.
   - **paste:** listen to the window `paste` event (not the keyboard shortcut) when the board is active and not typing. Order:
     1. Text starting with the prefix → parse → `cloneElements` with an offset so the copies are centered at the last pointer world position (or +16/+16 if pasted onto the same board and the originals are visible) → new z → create → restore doc fragments (apply the docs update into a temp doc, clone each fragment into the board's `docs` map under the new ids) → select.
     2. Image files in `clipboardData.files` → `onPasteImages` hook (a no-op now; step 15 fills it in).
     3. Plain text → a text element at the pointer (or viewport center) with that text.
   - Images from another board: asset ids in the payload are copied to the current board via `assetsRepo.get` + `put` with remapping (if the asset still exists).
3. `cloneHooks` / `beforeDeleteHooks` are already in the model. Make sure duplicate and paste use `cloneElements`, so step 20 can remap connectors in one place.
4. **Context menu** `src/lib/board/ui/CanvasContextMenu.svelte` (bits-ui `ContextMenu` on the canvas container; right-click first selects the element under the cursor if it isn't selected):
   - On element(s): Cut · Copy · Paste · Duplicate · Delete | Bring to front · Bring forward · Send backward · Send to back | Group / Ungroup · Lock / Unlock
   - On empty canvas: Paste · Select all · Zoom to fit
   - Each item shows its shortcut on the right (from the registry).
5. **Last pointer position:** track the pointer world position in `BoardContext` (`pointer = { x, y }`, non-reactive) for paste placement.

## Files
- create: `src/lib/board/commands/{index.ts, undo.ts, delete.ts, duplicate.ts, zorder.ts, lock.ts, group.ts, clipboard.ts}`, `src/lib/shared/base64.ts`, `src/lib/board/ui/CanvasContextMenu.svelte`
- modify: `TopBar.svelte`, `BoardWorkspace.svelte`, `context.ts`, `pointerRouter.ts`

## Tests
- `base64.test.ts`: round-trip of 0 bytes, 1 byte, 1 MB of random bytes.
- `zorder.commands.test.ts`: front/back/forward/backward on fixture docs (forward skips non-overlapping elements).
- `clipboard.test.ts`: serialize → parse round-trip including a doccard fragment's text; paste creates new ids; groups are remapped; rejects a malformed payload.
- `group.test.ts`, `lock.test.ts`.
- `tests/e2e/commands.spec.ts`: copy/paste a sticky → 2 stickies; Mod+D → 3; Delete → 2; Mod+Z → 3; group two → clicking one selects both; lock → drag doesn't move it; the context menu "Bring to front" changes the DOM order.

## Acceptance criteria
- [ ] `pnpm verify` and `pnpm test:e2e` pass
- [ ] Copy on board A → paste on board B works (a second tab or navigate)
- [ ] Undo/redo buttons reflect availability

## Out of scope
Image paste implementation (step 15), connector remapping (step 20).

## Commit
`feat(commands): add undo/redo, clipboard, duplicate, z-order, lock, group and context menu`
