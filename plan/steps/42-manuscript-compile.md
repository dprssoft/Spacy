# Step 42 — Manuscript compile

Phase: K. Writers · Depends on: 41 · Estimate: 2 days

## Goal
Turn the page's doc cards into one document in outline order: Markdown, Word (`.docx`), or a print-ready page (Save as PDF), with chapters from frames, optional scene separators and a title page.

## Read first
- `src/lib/board/doccards/{markdown.ts, exportMarkdown.ts, docJson.ts}`, `src/lib/board/files/docx.ts` (zip reading), `src/lib/shared/download.ts`

## Tasks
1. **Compile model** (`writing/compile.ts`, pure): `compile(outline, docs, opts) → DocNode` with chapter headings (frame titles, optional "Chapter 1:" numbering), card titles as scene headings or hidden, scene separator (`* * *`, a blank line, or none), title page (board title, author name from a local pref, date), only selected chapters, include/skip collapsed cards.
2. **Writers:**
   - Markdown: reuse `docToMarkdown` per part; front matter optional.
   - **DOCX** (`writing/docxWriter.ts`, no dependency): minimal WordprocessingML (styles for Title, Heading 1–3, Normal, Quote, lists, bold/italic/underline/strike/links, page breaks between chapters) zipped with stored entries and a CRC32 — round-trip tested with our own `docxToHtml` reader.
   - Print/PDF: a print view (new window/iframe with a print stylesheet: serif, 12 pt, 1.5 line height, margins, page breaks per chapter) and `window.print()`.
3. **Compile dialog** (Export menu → "Compile manuscript…", and a button in the outline panel): format, the options above, a live outline of what's included with word count, Download.
4. Mentions become plain text (or links for media); comments (step 45) are left out.

## Tests
- `compile.test.ts`: order, chapters, separators, title page, chapter selection, empty cards.
- `docxWriter.test.ts`: the output unzips (own reader), is valid XML, and `docxToHtml` gives back headings, paragraphs, lists and marks; CRC32 known values.
- e2e `compile.spec.ts`: Scene cards template → compile to Markdown (download content has 3 chapter headings in order and the scene text), to DOCX (download is a zip with `word/document.xml`), print view opens with the chapters.

## Acceptance criteria
- [ ] `pnpm verify` and `pnpm test:e2e` pass
- [ ] A compiled `.docx` opens in LibreOffice/Word with correct headings (manual check noted in PROGRESS; LibreOffice headless conversion in a test if available)

## Out of scope
EPUB (could follow the same model later), footnotes, custom styles.

## Commit
`feat(writing): compile doc cards into one manuscript (Markdown, Word, print/PDF)`
