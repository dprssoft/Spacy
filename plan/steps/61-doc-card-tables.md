# Step 61 — Tables in doc cards

Phase: N. Tables · Depends on: 45 · Estimate: 1.5 days

## Goal
Doc cards (on the board and in focus mode) can hold **tables**. Cells take the same text formatting as the rest of the card: bold, italic, underline, strikethrough, color, highlight, font, size, alignment, links.

Approved by the human on 2026-11-07: this lifts the "tables inside doc cards" non-goal (images inside doc cards stay a non-goal), changes the doc card schema, and bumps the board schema to 9.

## Read first
- `00-architecture.md` §5 (doc card text formatting, schema versions)
- `src/lib/board/doccards/{editorFactory.ts, slash.ts, DocRibbon.svelte, BubbleMenu.svelte, markdown.ts, docLines.ts, prose.css}`
- `src/lib/model/migrations.ts`

## Tasks
1. Add `@tiptap/extension-table` (same version as the other TipTap packages). Register `Table` (`resizable: false`: column drag-resizing measures screen pixels, which a zoomed board breaks), `TableRow`, `TableHeader` and `TableCell` in `docExtensions`. Columns share the width (`table-layout: fixed`, width 100 %).
2. Schema version **9**: no data moves. An older editor would delete table nodes it doesn't know, so older apps must not open the board.
3. Insert a table:
   - slash command "Table" (keywords `grid`, `columns`): a 3 × 3 table with a header row;
   - ribbon group "Table": an "Insert table" button when the caret is outside a table, otherwise a "Table" menu with Insert row above / below, Insert column left / right, Delete row, Delete column, Header row (toggle) and Delete table.
   - No table inside a table: the slash command is hidden and the insert button disabled while the caret is in one.
4. Keyboard: Tab / Shift+Tab move between cells (Tab in the last cell adds a row; this is the extension's behaviour). Formatting works in cells through the existing bubble menu, ribbon and shortcuts.
5. Styling in `prose.css`: 1 px cell borders in the text color at low opacity, header cells bold with a faint fill, cell padding 0.3em 0.5em, selected cells tinted with the accent.
6. Exports:
   - Markdown (`markdown.ts`): a GFM table. The first row is the header row (GFM needs one); `|` in cells is escaped; several blocks in a cell are joined with `<br>`; inline formatting is kept.
   - Static lines (`docLines.ts`; SVG/PNG/PDF exports and thumbnails): one line per row, cells joined with `  |  `; header rows use the heading weight.
   - Word count, find and replace, compile and import already walk nested content; check that they see cell text.

## Files
- modify: `package.json`, `doccards/{editorFactory.ts, slash.ts, DocRibbon.svelte, markdown.ts, docLines.ts, prose.css}`, `model/migrations.ts`
- create: `doccards/tableCommands.ts` (which table actions are available at the caret; types only, no TipTap import)

## Tests
- `markdown.test.ts`: a 2 × 3 table with a bold cell and a `|` → the expected GFM.
- `docLines.test.ts`: a table → one line per row.
- `slash.test.ts`: "tab" finds Table.
- `editorFactory.test.ts`: `insertTable` works and round-trips through the Yjs fragment (`fragmentToJSON`).
- `migrations.test.ts`: still green with version 9 (the widgets test pinned version 8: relax it to `≥ 8`).
- e2e `doccard-tables.spec.ts`: `/table` in a doc card → a 3 × 3 table; type in a cell, Tab to the next, Ctrl+B bolds; ribbon → Insert row below adds a row; reload keeps the table.

## Acceptance criteria
- [x] `pnpm verify` and the new e2e spec pass (chromium and firefox; WebKit CI only)
- [x] A table typed in a doc card survives a reload (focus mode uses the same editor extensions; not checked separately)
- [x] Markdown export of a card with a table is a valid GFM table

## Out of scope
Merging and splitting cells, column resizing, cell background colors, sorting, tables in the board's table element (step 62).

## Commit
`feat(doccards): tables`
