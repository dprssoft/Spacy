# Step 57 — Progress, status and deadline

Phase: M. Widgets · Depends on: 54 · Estimate: 1.5 days

## Goal
Tracking widgets for managers: a **progress** bar (set by hand or counted from a doc card's checklist), a **status** chip (On track / At risk / Blocked / Done) and a **deadline** badge ("3 days left").

## Read first
- Step 54 and its `PROGRESS.md` entry; `src/lib/board/doccards/*` (task lists in the Y.XmlFragment), `src/lib/shared/relativeTime.ts`

## Tasks
These are edits to the board, so they write `config` (LOCAL, undoable). None of them uses `state`.
1. **Progress** (Team):
   - Config: `{ source: 'manual' | 'checklist', value: number /* 0..100, manual */, cardId: string | null, look: 'bar' | 'ring', color: string }`.
   - `checklist`: done / total task items of the linked doc card, read from its `docs` fragment (`widgets/progress/checklist.ts`, pure over the XML) and updated on change. If the card is missing or has no tasks, it shows "No checklist". Link it with "Use selected doc card" in the settings or by dropping the widget on a card. The link is also drawn as a dashed hint while the widget is selected.
   - Manual: drag along the bar (an action zone with a drag) in 5 % steps (Shift: 1 %), or use the settings slider. A drag is one undo step.
   - View: the bar or ring, the percentage and the title.
2. **Status** (Team):
   - Config: `{ options: { label: string; color: string }[] /* 2..8 */, value: number }`. The defaults are On track (green), At risk (amber), Blocked (red) and Done (blue).
   - View: a colored pill with the label (a small default size of 120 × 32). Click (primary) cycles to the next option, and the settings edit the options. Connect it to anything with a connector, or group it with a card.
3. **Deadline** (Team):
   - Config: `{ date: string /* YYYY-MM-DD */, time: string | null /* HH:mm, local */, label: string }`.
   - View: the label, the date, and "in 3 days" / "today" / "2 days overdue". The color goes from neutral to amber (≤ 2 days) to red (overdue). It refreshes every minute through the ticker, and only while visible.
   - Settings: a date input (native `type=date`), an optional time, the label.
4. Add all three to the Widgets dropdown under **Team**.

## Files
- create: `src/lib/board/widgets/{progress,status,deadline}/*` (view, settings, pure logic + test each)
- modify: `widgets/catalog.ts`

## Tests
- `checklist.test.ts`: counts nested task items; no tasks → null; reacts to a toggled item.
- `deadline.test.ts`: relative labels across a DST change and at midnight; colors at the thresholds.
- `status.test.ts`: the cycle wraps; value clamped when options are removed.
- e2e: a doc card with 4 tasks → a progress widget linked to it shows 0 % → check 2 → 50 %; a status click cycles and Ctrl+Z goes back; a deadline in the past shows "overdue".

## Acceptance criteria
- [ ] `pnpm verify` and `pnpm test:e2e` pass
- [ ] A linked progress widget updates when a peer checks a task

## Out of scope
Rolling progress up across many cards or frames, reminders/notifications, calendar views, status of stickies themselves (status lives in its own chip).

## Commit
`feat(widgets): progress, status and deadline`
