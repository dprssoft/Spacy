# Step 44 — Find and replace

Phase: K. Writers · Depends on: 39 · Estimate: 1.5 days

## Goal
Search all text on the page — doc cards and every canvas text (shapes, stickies, text, frame titles, connector labels, media titles) — see the matches in context, jump between them, and replace one or all (e.g. renaming a character everywhere).

## Read first
- `src/lib/board/doccards/{editorFactory.ts, docJson.ts}`, `src/lib/model/ops.ts`, D10 (undo)

## Tasks
1. `writing/search.ts` (pure): matches in canvas texts and doc JSON with options (match case, whole word, regular expression with a safe timeout), returning `{ elementId, field | docPath, from, to, context }`.
2. **Find panel** (**Mod+F** on the board; Mod+F inside a focused doc card searches that card first): query, options, "12 matches in 5 objects", a list grouped by object, ↑/↓ (Enter / Shift+Enter) to step; stepping flies to the element and highlights the match (canvas: outline pulse; doc cards: a ProseMirror decoration).
3. **Replace:** one or all. Canvas fields via `updateElements` (one LOCAL transaction); doc card text via the collaboration fragment in a single Yjs transaction per card with the LOCAL origin, so **Replace all is one canvas undo step** for everything (documented exception to D10: whole-card edits from outside the editor already go through `docs` in canvas undo scope).
4. Scope selector: this page / all pages (results show the page; jumping switches page).

## Tests
- `search.test.ts`: case, whole word, regex (incl. a catastrophic pattern timing out), matches across marks/mentions in doc JSON, contexts.
- e2e `find-replace.spec.ts`: rename "Mara" → "Lena" across a sticky, a frame title and two doc cards with Replace all → all changed; one undo restores all; Mod+F inside a card; all-pages scope jumps to another page.

## Acceptance criteria
- [x] `pnpm verify` and `pnpm test:e2e` pass
- [x] Replace all keeps doc card formatting and mentions intact

## Commit
`feat(writing): find and replace across all text on the board`
