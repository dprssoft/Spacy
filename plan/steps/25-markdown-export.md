# Step 25 — Markdown export of doc cards

Phase: F. Doc cards · Depends on: 24 · Estimate: 1 day

## Goal
Export any doc card as Markdown (copy to clipboard or download a `.md` file), with a deterministic serializer covering exactly the supported schema. **Milestone M5.**

## Read first
- `src/lib/board/doccards/editorFactory.ts` (the supported nodes and marks)

## Tasks
1. **Serializer** `src/lib/board/doccards/markdown.ts` (pure, no TipTap import; operates on TipTap `JSONContent`):
   ```ts
   export function docToMarkdown(doc: JSONContent, opts?: { title?: string }): string
   ```
   - Title → `# {title}` followed by a blank line (if given).
   - Nodes: paragraph; heading (levels 1–3 → `#`…`###`); bulletList (`- `); orderedList (`1. ` with `attrs.start`, incrementing); taskList/taskItem (`- [x] ` / `- [x] `); blockquote (`> ` prefix on every line, including nested blocks); codeBlock (fenced with ```` ``` ```` + `attrs.language`; a longer fence if the content contains ```` ``` ````); horizontalRule (`---`); hardBreak (two trailing spaces + newline); mention (`@label`).
   - Nested lists: 2-space indent for bullet and task lists, 3-space indent for ordered lists; paragraphs inside list items are joined correctly.
   - Marks: bold `**`, italic `_`, strike `~~`, code `` ` `` (a longer backtick fence if the text contains backticks; no other marks inside code), link `[text](href)`. Apply marks in a stable order and merge adjacent text nodes with identical marks.
   - Escape Markdown-significant characters in plain text: `\ * _ ` [ ] #` at a line start, `>` at a line start, `-`/`+` list markers at a line start, and `1.` at a line start.
   - Blocks are separated by exactly one blank line, and the output ends with a single newline.
2. **Getting JSON** `src/lib/board/doccards/docJson.ts`: `getDocJSON(ctx, id): Promise<JSONContent>`: if a live editor exists for the card (keep a registry `Map<cardId, Editor>` in the doccards module, populated by the views and focus mode), use `editor.getJSON()`; otherwise create a headless editor (detached div, `editable: false`) on the fragment, read `getJSON()`, then destroy it.
3. **UI:** a "⋯" menu in the doc card header and in the focus mode top bar with: "Copy as Markdown" (`navigator.clipboard.writeText` → toast "Copied as Markdown") and "Download .md" (filename `slug(title) || 'doc'` + `.md`). Also add both to the canvas context menu when a single doc card is selected.
4. `src/lib/shared/slug.ts`: `slug(text)`: lowercase, ASCII-fold (NFKD + strip diacritics), non-alphanumeric → `-`, collapse and trim dashes, max 60 characters. `src/lib/shared/download.ts`: `downloadBlob(blob, filename)`.

## Files
- create: `src/lib/board/doccards/{markdown.ts, docJson.ts, DocCardMenu.svelte}`, `src/lib/shared/{slug.ts, download.ts}`
- modify: `DocCardHeader.svelte`, `FocusMode.svelte`, `CanvasContextMenu.svelte`, `DocCardView.svelte` (the editor registry)

## Tests
- `markdown.test.ts` (table-driven, with inline expected strings): every node type; every mark; nested bullet → ordered → task lists; blockquote containing a list; a code block containing a backtick fence; escaping of `*`, `_`, `#` at a line start; a mention; ordered list `start: 3`; an empty doc → only the title.
- `slug.test.ts`: diacritics, symbols, length.
- `tests/e2e/markdown.spec.ts`: create a card with an H2 and a checklist → "Download .md" → the downloaded file content matches the expected Markdown.

## Acceptance criteria
- [x] `pnpm verify` and `pnpm test:e2e` pass
- [x] The Markdown output renders the same in a standard CommonMark/GFM viewer (manual spot check)
- [x] **M5 demo:** a whiteboard with diagrams and doc cards together

## Out of scope
Markdown import (not planned).

## Commit
`feat(doccards): add Markdown export for doc cards`
