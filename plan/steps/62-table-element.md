# Step 62 — Table element

Phase: N. Tables · Depends on: 61 · Estimate: 2.5 days

## Goal
A **table** object on the board, next to stickies and doc cards: a grid of cells with basic text formatting (bold, italic, underline, strikethrough, color, alignment). It can be moved, resized, styled, connected with connectors, and exported.

Approved by the human on 2026-11-07: new element type `table`, board schema 10.

## Read first
- Step 61 and its `PROGRESS.md` entry
- `00-architecture.md` §5 (elements, `docs` map, schema versions)
- `src/lib/board/elements/doccard/*`, `src/lib/board/tools/{create.ts, doccard.ts}`, `src/lib/board/render/{staticSvg.ts, canvasScene.ts}`

## Data model
```ts
export interface TableElement extends BaseElement {   // schema version 10
  type: 'table';            // not rotatable; content lives in docs[id]
}
```
- The cells live in `docs[id]`, a `Y.XmlFragment` whose only block is one table node (the step 61 schema). Everything that already follows `docs` by element id (delete, duplicate, pages, paste, import, find and replace, word count) covers it; places that create or check a fragment by type (`ops.ts`, `clipboard.ts`, `fileFormat.ts`) use one helper, `hasDocContent(type)`.
- Only tables, cells and paragraphs with inline formatting are kept in a table element: the editor's content expression is `table`, and cells are `paragraph+`.

## Tasks
1. Types, zod schema, migration 10, `hasDocContent`.
2. Element view: the table rendered by a TipTap editor (read-only until edited), like a doc card without the header. Double-click a cell → editing with the caret in that cell; Escape leaves. The box's height follows the content (written once editing ends, one undo step with the edit); the width is the user's.
3. Tool and toolbar: "Table" (key `G`; `B` is the sketch tool) in the toolbar's secondary tools; click → a 3 × 3 table with a header row, 360 × auto; drag → that width. Also in "Insert more" on phones and in the a11y creation tools.
4. Formatting: the doc card bubble menu (bold, italic, underline, strikethrough, color, highlight, link) and a slim ribbon with alignment and the step 61 row/column menu. Style bar: stroke (grid lines) color and width, fill, font size and family, opacity.
5. Rendering: static SVG draws the real grid (column widths equal, row heights from wrapped text), with bold/italic per run; the scene canvas draws the grid and skeleton bars when zoomed out.
6. Markdown: "Copy as Markdown" in the context menu gives the GFM table.

## Tests
- `schema.test.ts`, `migrations.test.ts`: version 10, a table element parses.
- `tableLayout.test.ts`: row heights and column widths for the static renderer.
- `staticSvg.test.ts`: a 2 × 2 table → 4 cell texts and the grid lines.
- e2e `table-element.spec.ts`: B, click → table; double-click a cell, type, Tab, Ctrl+I; Escape; connect a connector to it; duplicate keeps the content; undo removes it; export SVG contains the cell text.

## Acceptance criteria
- [x] `pnpm verify` and the new e2e spec pass (chromium, firefox; WebKit CI only)
- [x] Table survives reload, duplicate, copy/paste and `.spacy` export/import (page duplication copies `docs` by id like doc cards; not tested separately)
- [x] Connectors attach to the table like to any box (connectable matrix test; dragging a "+" draws one)

## Out of scope
Per-cell fills, column resizing by drag, formulas, sorting, CSV import.

## Commit
`feat(tables): table element`
