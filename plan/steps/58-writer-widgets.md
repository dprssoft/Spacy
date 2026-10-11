# Step 58 — Writer widgets

Phase: M. Widgets · Depends on: 54 · Estimate: 2 days

## Goal
Widgets for writers: a **word goal** (total or daily, from the board's doc cards), a **writing sprint** (a timer that counts the words written during it) and a **generator** for names, places, prompts and plot twists.

## Read first
- Step 54 and its `PROGRESS.md` entry; `src/lib/board/widgets/timer/*`
- `src/lib/board/writing/{wordCount.ts, boardStats.svelte.ts}`, `src/lib/model/outline.ts`

## Tasks
1. **Word goal** (Writing):
   - Config: `{ target: number, scope: 'board' | 'page' | 'manuscript' | 'cards', cardIds: string[], period: 'total' | 'daily', deadline: string | null /* YYYY-MM-DD */ }`. "Manuscript" means the cards in the outline (step 41); "cards" means the cards picked with "Use selected".
   - The word count comes from `boardStats` (it's already computed and cached; nothing is recounted per frame).
   - Daily: state `{ day: string; startWords: number }` (WIDGET origin). It is written by the first client that sees a new local day, and shows "words today = now − startWords". With a deadline, it also shows "≈ 812 words a day to finish".
   - View: a ring, "12,340 / 50,000 words" (or "640 / 1,000 today"), and a small check mark when the goal is reached.
2. **Writing sprint** (Writing): reuses the timer's pure logic.
   - Config: `{ duration: number /* default 25 min */, target: number | null, scope as in word goal }`.
   - State: the timer state plus `{ startWords: number | null, log: { at: number; minutes: number; words: number }[] /* last 20 */ }`.
   - Start records `startWords`; the end (or "Finish") adds a log row. During the sprint it shows "+212 words" live. At the end it chimes and shows "+412 words in 25 min".
   - Actions: Start/pause (primary), Finish, Reset. The settings have presets 15 / 25 / 45 min and the log.
3. **Generator** (Writing):
   - Config: `{ list: 'character' | 'place' | 'prompt' | 'twist' | 'object' | 'custom', custom: string[], count: number /* 1..5 */ }`.
   - State: `{ draw: { seed; at; result: string[] } | null, history: string[] /* last 10 */ }` (the step 55 randomness).
   - Built-in lists in `widgets/generator/lists.ts`, loaded on first use: about 150 English entries each, written for this project (no copied lists). Character names mix first and last names from several cultures.
   - Actions: Generate (primary), "Place as sticky".
4. Add all three to the Widgets dropdown under **Writing**.

## Files
- create: `src/lib/board/widgets/{wordgoal,sprint,generator}/*` (view, settings, pure logic + test each)
- modify: `widgets/catalog.ts`, `widgets/timer/timer.ts` (exported for reuse if needed)

## Tests
- `wordgoal.test.ts`: scopes; daily rollover at local midnight; words a day to the deadline.
- `sprint.test.ts`: words written = end − start (negative after deleting text shows as 0 gained, with the real delta in the log).
- `generator.test.ts`: lists are non-empty with no duplicates; same seed → same result.
- e2e: a word goal of 10 → typing 12 words in a doc card shows it reached; a sprint started → type → "+N words".

## Acceptance criteria
- [ ] `pnpm verify` and `pnpm test:e2e` pass
- [ ] Typing in a doc card doesn't make the word goal recount on every keystroke (it uses the debounced board stats)

## Out of scope
Streaks and calendars, statistics across boards, AI-generated prompts, per-session writing history outside the widget.

## Commit
`feat(widgets): word goal, writing sprint and generator for writers`
