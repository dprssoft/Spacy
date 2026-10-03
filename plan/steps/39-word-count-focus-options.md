# Step 39 — Word count and focus mode options

Phase: K. Writers · Depends on: 38 · Estimate: 1 day

## Goal
Writers always know how much they've written: live word and character counts and reading time for a doc card, the selection and the board. Focus mode gains optional writing aids, each off by default and remembered per browser.

## Read first
- `src/lib/board/doccards/{FocusMode.svelte, DocRibbon.svelte, docJson.ts, fragmentJson.ts, markdown.ts}`, `src/lib/board/elements/doccard/DocCardHeader.svelte`
- `src/lib/board/ui/StatusBar.svelte`, `src/lib/shared/localPrefs.ts`

## Tasks
1. **Counting** (`doccards/wordCount.ts`, pure): words (Unicode-aware: `Intl.Segmenter` with `granularity: 'word'`, `isWordLike`; fallback regex), characters with and without spaces, paragraphs, reading time (238 wpm, rounded up, "< 1 min"). Input: doc JSON or plain text (canvas text elements count too).
2. **Where it shows:**
   - doc card footer while editing (and on hover): "1,240 words · 5 min read"; the selection inside a card shows "84 of 1,240 words".
   - focus mode: a quiet counter bottom-right (click for the details: characters, paragraphs, reading time).
   - status bar: for the selection ("3 selected · 2,105 words") or the page when nothing is selected; hidden when there are no words.
   Counts update at most every 300 ms while typing (idle callback) so long documents stay smooth.
3. **Focus mode options** (a "View" menu in focus mode; `localPrefs` `smthng:focus`):
   - **Typewriter scrolling:** the caret line stays at 40 % of the height.
   - **Focus paragraph:** paragraphs other than the caret's are dimmed (opacity .35, CSS on the ProseMirror node with a decoration).
   - **Line width:** narrow (60ch), medium (72ch, default), wide (90ch).
   - **Reading font:** the doc's font, or Literata-style serif (Lora, bundled) for comfortable reading; size S/M/L.
   - **Hide interface:** only the text remains (header, ribbon and counter fade in on mouse move / tap, out after 2 s); combines with Full screen (Shift+F).

## Tests
- `wordCount.test.ts`: English, punctuation, numbers, hyphens/apostrophes, CJK (each character a word via Segmenter), emoji, empty; reading time; doc JSON with lists, headings and mentions.
- e2e `writing-stats.spec.ts`: type in a doc card → footer count; select two words → "2 of N"; status bar totals for a selection of two cards; focus mode counter; each focus option toggles (typewriter: caret line near 40 % after typing 30 lines; focus paragraph: other paragraphs dimmed; hide interface: header hidden, back on mouse move) and persists after a reload.

## Acceptance criteria
- [x] `pnpm verify` and `pnpm test:e2e` pass
- [x] Typing in a 20,000-word card stays responsive (no counting on every keystroke; measured)
- [x] All focus options are off by default

## Out of scope
Writing goals, streaks and timers (not requested).

## Commit
`feat(writing): word count and reading time; optional focus mode aids`
