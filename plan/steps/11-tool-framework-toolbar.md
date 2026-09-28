# Step 11 — Tool framework and toolbar

Phase: C. Canvas · Depends on: 10 · Estimate: 1 day

## Goal
A tool system (state machines receiving normalized pointer events with hit info), a shortcut registry, a selection state, the hand tool, a minimal select tool (click to select), and the toolbar.

## Read first
- `00-architecture.md` §9 (Tool, CanvasPointerEvent), §11 (shortcuts)

## Tasks
1. `src/lib/board/tools/types.ts`: `ToolId`, `CanvasPointerEvent`, `Tool`, `HandleId` (`'nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w'|'rotate'|string`) from §9.
2. `src/lib/board/selection.svelte.ts`:
   ```ts
   export class SelectionState {
     ids = new SvelteSet<string>();
     editingId = $state<string | null>(null);
     hoverId = $state<string | null>(null);
     set(ids: Iterable<string>), add(id), toggle(id), clear(), has(id)
     get single(): string | null
   }
   ```
   It prunes ids that no longer exist in the store (subscribe to `store.version`).
3. **Hit testing** `src/lib/board/engine/hitTest.ts`: `hitElement(store, p: Point, tol: number): string | null` → candidates from `index.search` of a small rect, filtered by `definition.hitTest`, topmost by z (non-frames above frames). `hitElementsInRect(store, rect, mode: 'intersect' | 'contain'): string[]`.
4. **Handle registry**: `src/lib/board/tools/handles.ts` exports `handleProviders: ((screen: Point) => HandleId | null)[]`. The pointer router checks these first (step 13 registers the selection handles).
5. **Pointer router** `src/lib/board/tools/pointerRouter.ts`: an attachment/action on the Canvas container:
   - `pointerdown` (left button, or pen/touch primary; middle and right buttons are ignored here) → `setPointerCapture` → builds `CanvasPointerEvent` (world via `screenToWorld`, `mod = ctrlKey || metaKey`, hit = handle ?? element with `tol = 6 / zoom`) → `tools.current.onPointerDown`.
   - `pointermove` → current tool (and updates `selection.hoverId` when no button is pressed).
   - `pointerup` / `pointercancel` → `onPointerUp` / `onCancel`.
   - `dblclick` → `onDoubleClick`.
   - Skips events while space-panning (step 09) and events whose target is inside `[data-interactive]` (popovers, editors).
6. **Tool manager** `src/lib/board/tools/toolManager.svelte.ts`: `current = $state<ToolId>('select')`, `locked = $state(false)`, `shapeKind = $state<ShapeKind>('rect')`, `setTool(id)` (calls `onCancel` on the previous tool), `get tool(): Tool`, `returnToSelect()` (unless locked). Tools are created with a `ToolDeps` object `{ ctx: BoardContext }`. Add `tools` and `selection` to `BoardContext`.
7. **Hand tool** `tools/hand.ts`: drag pans (cursor grab/grabbing).
8. **Select tool (minimal)** `tools/select.ts`: pointerdown on an element → select it (Shift toggles); on empty → clear. Full behavior comes in step 13.
9. **Shortcut registry** `src/lib/board/tools/shortcuts.ts`:
   ```ts
   export interface Shortcut { id: string; keys: string[]; label: string; group: 'Tools'|'Edit'|'View'|'Arrange'|'Diagram'|'Doc'; run(ctx): void; when?(ctx): boolean }
   export function matchesKeys(e: KeyboardEvent, keys: string): boolean  // 'Mod+Shift+Z', 'Shift+1', ']', '?', 'Delete'
   export function isTypingTarget(t: EventTarget | null): boolean       // input, textarea, select, [contenteditable]
   export const registry: Shortcut[]; export function registerShortcuts(list: Shortcut[]): void
   ```
   `matchesKeys` uses `e.key` for printable keys (case-insensitive letters) and `e.code` for digits with Shift (`Shift+1` → `Digit1`). `Mod` = `metaKey` on macOS (`navigator.platform`/`userAgentData`), else `ctrlKey`.
   A window `keydown` listener in `BoardWorkspace`: if not typing → first `tools.tool.onKeyDown?.(e)`; if unhandled → the first matching shortcut → `preventDefault` + run.
   Register tool shortcuts (V, H, P, E, R, O, D, A, T, S, N, F, Mod+Shift+I) and move the view shortcuts from step 09 here. **Escape:** tool `onCancel` → if the selection is not empty, clear it → else switch to select.
10. **Toolbar** `src/lib/board/ui/Toolbar.svelte`: a floating vertical pill at the left center (at widths < 640px: a horizontal pill bottom-center). `role="toolbar"`, `aria-orientation`. Buttons (lucide icons) with `aria-pressed` and a bits-ui Tooltip "Rectangle — R":
    Select (MousePointer2) · Hand (Hand) | Pen (Pencil) · Eraser (Eraser) | Shapes (Square; a flyout with Rectangle / Ellipse / Diamond; the last used kind shows as the icon) · Connector (ArrowUpRight) · Text (Type) · Sticky (StickyNote) · Doc card (FileText) · Frame (Frame) · Image (Image) | Lock tool (Lock/Unlock).
    Tools not implemented yet are `disabled` with the tooltip "Coming soon".
11. Canvas cursor from `tools.tool.cursor` (`crosshair` for creation tools, `default` for select).

## Files
- create: `src/lib/board/tools/{types.ts, handles.ts, pointerRouter.ts, toolManager.svelte.ts, hand.ts, select.ts, shortcuts.ts}`, `src/lib/board/selection.svelte.ts`, `src/lib/board/engine/hitTest.ts`, `src/lib/board/ui/Toolbar.svelte`
- modify: `Canvas.svelte`, `BoardWorkspace.svelte`, `context.ts`, `viewportInput.ts`

## Tests
- `shortcuts.test.ts`: `matchesKeys` for `Mod+Z` (mac and non-mac), `Mod+Shift+Z`, `Shift+1`, `]`, `?`, letters with and without Caps Lock; `isTypingTarget`.
- `hitTest.test.ts`: topmost wins; a rotated element; tolerance; `contain` vs `intersect`.
- `tests/e2e/tools.spec.ts`: pressing R marks Rectangle as `aria-pressed=true`; Escape returns to Select; clicking a test-hook-created sticky selects it (verify through `window.__smthng.ctx.selection`).

## Acceptance criteria
- [x] `pnpm verify` and `pnpm test:e2e` pass
- [x] Shortcuts don't fire while typing in the title input
- [x] The toolbar is fully operable by keyboard (Tab into it, Enter/Space activate)

## Out of scope
Creation tools (step 12), full selection and transforms (step 13).

## Commit
`feat(tools): add tool framework, hit testing, shortcut registry and toolbar`
