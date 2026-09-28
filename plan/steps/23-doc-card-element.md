# Step 23 — Doc card element

Phase: F. Doc cards · Depends on: 20 · Estimate: 2 days

## Goal
Doc cards: canvas elements with a title and a collaborative TipTap rich-text body bound to a `Y.XmlFragment`. They can be edited in place, collapsed, resized and connected.

## Read first
- `00-architecture.md` §3 (D10), §5 (DocCardElement, `docs` map), §1 non-goals (no tables or images in doc cards)
- `src/lib/model/ops.ts` (doccard fragment creation and deletion), `src/lib/board/commands/clipboard.ts`

## Tasks
1. **Install TipTap v3** and confirm the current package names in the official TipTap docs before installing (v3 consolidated some extensions). The target feature set:
   - core + StarterKit (paragraph, headings 1–3, bold, italic, strike, code, bullet list, ordered list, blockquote, code block, horizontal rule, hard break, link; **disable** StarterKit's built-in undo/redo — v3 option `undoRedo: false`)
   - task list + task item (nested)
   - placeholder
   - collaboration (Yjs; in v3 this may require `@tiptap/y-tiptap` instead of `y-prosemirror`; follow the docs)
   Record the exact packages and versions in PROGRESS.
2. **Editor factory** `src/lib/board/doccards/editorFactory.ts`:
   ```ts
   export function docExtensions(fragment: Y.XmlFragment, opts: { placeholder?: string }): Extensions
   export function createDocEditor(opts: { element: HTMLElement; fragment: Y.XmlFragment; editable: boolean;
     onFocus?(): void; onBlur?(): void }): Editor
   ```
   - Headings limited to levels 1–3. The link extension uses `openOnClick: false` and `autolink: true`, and validates `http(s):`/`mailto:` protocols only.
   - The collaboration extension is configured with `fragment` (not `document`) and provides its own undo within the editor (D10).
   - Keep this module the **only** place that imports TipTap packages, so it can be lazy-loaded (step 30).
3. **Doc card view** `src/lib/board/elements/doccard/DocCardView.svelte`:
   - Card: background fill, border and radius from the style, and a shadow.
   - Header (40 px): a title (an `InlineEditable` on double-click; the default title is "Untitled"), a collapse chevron button, and an "Open" (Maximize2) button (wired in step 24; hidden until then).
   - Body: a `div` mounted with `createDocEditor` in `$effect` (destroy on cleanup). `overflow-y: auto`, padding 12–16 px, typography scaled by `style.font.size` (s = 14 px base). Prose styles in `src/lib/board/doccards/prose.css` (headings, lists, checklists with checkboxes, blockquote, code, hr, links) for light and dark.
   - Non-editing state: the editor is mounted with `editable: false` (read-only rendering of live content).
   - Collapsed: only the header is shown; `h` = 40 while collapsed (store the previous height in `expandedH`); expanding restores it. Collapsing and expanding are one undo step, and connectors follow automatically (the AABB changes).
4. **Interaction rules**
   - Selecting: a single click selects the card (like any element; the wrapper stays `pointer-events: none`).
   - **Enter editing:** double-click on the body, or Enter while the card is the single selection → `selection.editingId = id` → the wrapper body becomes `pointer-events: auto` + `data-interactive`, the editor becomes editable and focused (click position → set the text selection via `editor.view.posAtCoords` when entered by double-click).
   - While editing: pointer events inside the body don't reach the canvas tools (the pointer router already skips `data-interactive`); a wheel inside the body scrolls the body if it can scroll in that direction (then `stopPropagation`), otherwise the canvas pans.
   - **Exit editing:** Escape (first press exits editing and keeps the card selected), or a pointerdown outside the card.
   - Canvas shortcuts are ignored while the editor has focus (contenteditable). Mod+Z inside the editor = editor undo.
   - A task-list checkbox click works in read-only mode too (convenience): handle it by temporarily allowing the toggle transaction, or require edit mode. Choose the simplest option and record it.
5. **Doc card tool** `tools/doccard.ts` (N): click → create a 360×280 card centered on the pointer → enter editing with the cursor in the body.
6. **Resize:** min 240×120; while collapsed, only the width can be resized.
7. **Copy, paste, duplicate:** verify that step 14's clipboard fragment cloning works with real content. Duplicate must clone the fragment (`fragment.clone()` into `docs` under the new id): extend `duplicateSelection` if needed.
8. **Undo check:** the canvas UndoManager scope is the `elements` map only, so doc text edits don't enter canvas undo; creating or deleting a card does (its fragment is created and deleted in the same transaction via `ops.ts`, and undoing the deletion must restore the text — **verify this**: if Yjs undo of the elements map doesn't restore the `docs` entry, add `getDocsMap(doc)` to the UndoManager scope with the same `trackedOrigins`. Editor transactions use the y-prosemirror origin, not `LOCAL`, so they stay untracked. Record the result in PROGRESS).
9. Enable the Doc card toolbar button. Set `styleOptions` for doccard (fill, stroke, radius, shadow, fontSize).

## Files
- create: `src/lib/board/doccards/{editorFactory.ts, prose.css}`, `src/lib/board/elements/doccard/{definition.ts, DocCardView.svelte, DocCardHeader.svelte}`, `src/lib/board/tools/doccard.ts`
- modify: `elements/index.ts` (replace the placeholder), `ElementView.svelte`, `select.ts`, `commands/duplicate.ts`, `Toolbar.svelte`, possibly `storage/boardDoc.ts` (undo scope)

## Tests
- `editorFactory.test.ts` (jsdom): create an editor on a fragment → `editor.commands.insertContent('<h1>Hi</h1><ul><li>a</li></ul>')` → the fragment's `toString()` contains the heading and list; a second Y.Doc synced via updates renders the same `editor.getText()`.
- `doccard.undo.test.ts`: create a card, type text via an editor, delete the card with origin LOCAL, undo → the fragment content is restored.
- `tests/e2e/doccard.spec.ts`: N + click → type "# Plan" (the markdown shortcut makes an H1) then "- item" → Escape → reload → the H1 "Plan" and the list item are visible. A second page on the same board sees the typed text within 1 s. Collapse → the card height is 40 → a connector attached to it still ends at its border. Copy/paste the card → the new card has the same text.

## Acceptance criteria
- [ ] `pnpm verify` and `pnpm test:e2e` pass
- [ ] Text selection with the mouse works inside an editing card and never moves the card
- [ ] Undo of card deletion restores the text
- [ ] TipTap is imported only from `editorFactory.ts` (and step 24/25 doccard modules)

## Out of scope
Focus mode, bubble menu, slash commands, mentions (step 24); Markdown (step 25).

## Commit
`feat(doccards): add collaborative rich-text doc cards on the canvas`
