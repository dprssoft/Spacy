# Step 40 — Writer templates

Phase: K. Writers · Depends on: 34 · Estimate: 1 day

## Goal
A "Writing" category in the template gallery with ready-made boards for planning stories, articles and scripts. They're chosen from the gallery like any template, inserted into a board or used to start one.

## Read first
- `src/lib/templates/{index.ts, builder.ts, kanban.ts, meetingNotes.ts}` (doc card content), step 33/34 PROGRESS entries

## Tasks
Add a `'Writing'` category and these templates (each its own lazy module; doc cards get starter text with headings and prompts):
1. **Three-act structure:** frames Act I / II / III (25 / 50 / 25 % widths) with beat stickies (Inciting incident, Plot point 1, Midpoint, Plot point 2, Climax, Resolution) and a "Logline" doc card.
2. **Hero's Journey:** 12 stage stickies around a circle, connected in order, with short prompts.
3. **Save the Cat beat sheet:** the 15 beats as scene cards in 4 rows (with page/percentage hints).
4. **Character profile:** a doc card template (Name, Role, Want, Need, Flaw, Arc, Voice, Backstory) + a frame "Relationships" with connected character stickies.
5. **World-building:** frames Places, Cultures, Rules/Magic, History, with doc cards for each.
6. **Scene cards (corkboard):** a frame per chapter (3) with 4 scene doc cards each (POV, Goal, Conflict, Outcome) — ready for the outline (step 41) and compile (step 42).
7. **Article outline:** Hook, Thesis, Sections 1–3, Counterpoints, Conclusion, Sources as doc cards in reading order.
8. **Screenplay / episode outline:** Teaser + Acts 1–4 frames with scene stickies (INT./EXT. slugline prompts) and a "Characters" doc card.
The gallery's featured row on the start page doesn't change.

## Tests
- The shared template tests (valid elements, connectors, frame containment, no overlaps, size) run over the new ones automatically; content checks: Save the Cat has 15 beats; scene cards has 3 frames × 4 doc cards whose text contains "Goal".
- e2e: gallery → Writing → Hero's Journey inserts 12 connected stickies.

## Acceptance criteria
- [x] `pnpm verify` and `pnpm test:e2e` pass
- [x] Screenshots of each template (light and dark) reviewed

## Commit
`feat(templates): writing templates (story structures, characters, world-building, scene cards, article, screenplay)`
