# Step 60 — Templates for writers and facilitators

Phase: M. Widgets · Depends on: 55, 57 · Estimate: 1.5 days

## Goal
More writing templates, plus ready-made facilitation boards with timers and wheels already placed.

## Read first
- Step 59; `src/lib/templates/{threeAct.ts, sceneCards.ts, brainstorm.ts}`

## Tasks
1. **Writing**:
   - **Snowflake method**: the 10 steps as frames, from a one-sentence summary to scene lists, with doc cards.
   - **Chapter tracker**: a row of chapter doc cards in the outline, each with a status chip (Draft / Revising / Done).
   - **Plot grid**: a subplots × chapters grid (rows A/B/C plot, 8 columns) of stickies.
   - **Revision checklist**: a doc card with structural, line and copy edit passes as checklists, and a progress widget linked to it.
   - **Series bible**: frames for characters, places, timeline and rules, with linked doc cards.
2. **Workshops** (facilitation):
   - **Icebreaker**: a wheel with team-member placeholders, a 2-minute timer and question stickies.
   - **Workshop agenda**: sections as frames, each with its own timer set to the section length.
   - **Daily stand-up**: a randomizer for speaking order (shuffle mode) and a 15-minute timer.
3. Featured templates on the start page stay unchanged; these are in "More templates".

## Files
- create: `src/lib/templates/{snowflake,chapterTracker,plotGrid,revisionChecklist,seriesBible,icebreaker,workshopAgenda,standup}.ts`
- modify: `templates/index.ts`

## Tests
- `templates.test.ts` covers the new templates (build, valid elements and widget configs, outline ids exist).
- e2e: new board from "Icebreaker" → Spin the wheel → a winner shows; the timer starts. (The Lean coffee test is archived with dot voting.)

## Acceptance criteria
- [ ] `pnpm verify` and `pnpm test:e2e` pass

## Out of scope
User-made templates, localization of template text.

## Commit
`feat(templates): writing and facilitation templates with widgets`
