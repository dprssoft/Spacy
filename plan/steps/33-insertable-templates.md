# Step 33 — Insertable templates

Phase: I. Extensions · Depends on: 28 · Estimate: 1 day

## Goal
Any template can be added to the board you're working on, not only used to start a new board. Insert → Templates opens a gallery, and the chosen template lands in the middle of the view as ordinary, editable content, selected, as one undo step.

## Read first
- `00-architecture.md` §5 (data model, D10 undo), §9 (board context)
- `src/lib/templates/{index.ts, builder.ts, preview.ts, create.ts}`
- `src/lib/board/commands/clipboard.ts` (`pastePayload`, `cloneElements`, `createWithContent`)
- `src/lib/board/ui/Toolbar.svelte`, `src/lib/home/TemplatesRow.svelte`

## Tasks
1. **Registry metadata** (`templates/index.ts`): add `category: 'Planning' | 'Diagrams' | 'Workshops' | 'Strategy' | 'Notes'`, `keywords: string[]` and `featured: boolean` to `Template`. The start page row shows `featured` templates only (today's three) plus a "More templates" card that opens the same gallery and creates a new board from the pick.
2. **Insert into a board** (`templates/insert.ts`, lazy): `insertTemplate(ctx, t)`.
   - Build the template into a temporary `Y.Doc` with the existing `t.build(doc)`. Templates keep writing with `TEMPLATE`; nothing in the temp doc is undoable or persisted.
   - Copy into the board with the paste helpers. Extract the parts of `pastePayload` that don't depend on a clipboard string into `insertElements(ctx, els, fragments, sketches, offset)` in `clipboard.ts`, and use it from both. The result: new ids (connector endpoints, `parentId`, groups remapped), doc card contents and sketch strokes copied, one `LOCAL` transaction = one undo step, everything selected, Select tool active.
   - Placement: the template's bounds are centered on the view center. If they don't fit the view at the current zoom, fit the view to them (`viewport.fit(bounds)`, animated) instead of scaling the elements.
   - Templates go on the active page; frame membership is synced for the new elements (`syncFrameMembership`).
3. **Gallery** (`board/ui/TemplateGallery.svelte`, bits-ui `Dialog`): a search field (name, description, keywords), category chips, and a grid of cards with the preview image (`templatePreview`, cached per session), name and description. Enter or a click inserts; Escape closes. Keyboard: arrows move between cards.
4. **Entry points**: a "Templates" button in the toolbar's Insert group (icon `LayoutTemplate`), an "Insert template" entry in the shortcuts help, and the same gallery from the start page ("More templates", which calls `createBoardFromTemplate` instead).
5. Make sure the gallery, previews and template modules stay lazy: the board's initial bundle grows by the button only.

## Files
- create: `src/lib/templates/insert.ts`, `src/lib/board/ui/TemplateGallery.svelte`, `src/lib/board/ui/TemplateCard.svelte` (or reuse `home/TemplateCard.svelte` if it fits)
- modify: `templates/index.ts`, `board/commands/clipboard.ts`, `board/ui/Toolbar.svelte`, `home/TemplatesRow.svelte`, shortcuts help

## Tests
- `insert.test.ts`: inserting each template into a board with existing content → new ids only, no collisions; connectors attach to the new copies; frame children keep their frame; doc card contents copied; a single undo removes everything; inserting twice gives two independent copies.
- `tests/e2e/templates.spec.ts` (extend): open the gallery from the toolbar, search "brain", insert → elements appear centered and selected; Ctrl+Z removes them; "More templates" on the start page creates a board.

## Acceptance criteria
- [ ] `pnpm verify` and `pnpm test:e2e` pass
- [ ] A template inserted at any zoom ends up fully visible
- [ ] The board's initial JS doesn't include template builders or previews (check the build chunks)

## Out of scope
New templates (step 34). User-saved templates ("Save selection as template").

## Commit
`feat(templates): insert any template into the current board from a gallery`
