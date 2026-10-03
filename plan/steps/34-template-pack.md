# Step 34 — Template pack (kanban and friends)

Phase: I. Extensions · Depends on: 33 · Estimate: 2 days

## Goal
Nine more templates, built from existing elements only (frames, stickies, shapes, text, doc cards, connectors), and a "Stack contents" command that tidies the cards in a frame, so a kanban stays neat without auto-layout.

## Read first
- `src/lib/templates/{builder.ts, flowchart.ts, brainstorm.ts}`
- `src/lib/board/commands/arrange.ts`, `src/lib/board/frameMembership.ts`
- `00-architecture.md` §1 non-goals (auto-layout and swimlanes are non-goals: templates are static layouts, and "Stack contents" runs only when asked)

## Tasks
1. **Templates** (one module each under `src/lib/templates/`, registered with category and keywords). Use the 50-color palette's pastel rows for frames and stickies; frame titles in sentence case.
   - **Kanban** (Planning): frames "To do", "In progress", "Done" (320 × 720, 40 px apart) under a title text; 3 / 2 / 1 starter stickies stacked in them ("Task", "Task", …); stickies have `parentId` set.
   - **Retrospective** (Workshops): frames "Went well", "To improve", "Action items" (green / red / blue tints), two stickies each, a text with the date placeholder.
   - **SWOT analysis** (Strategy): 2 × 2 frames "Strengths", "Weaknesses", "Opportunities", "Threats" with a sticky in each.
   - **Eisenhower matrix** (Planning): 2 × 2 frames "Do", "Schedule", "Delegate", "Eliminate", with axis labels "Urgent → / Important ↓" as text.
   - **Mind map** (Diagrams): a central ellipse "Main idea", 4 rounded rectangles around it, 2 children for each, curved connectors without markers.
   - **Timeline** (Planning): a horizontal line (a connector between two invisible endpoints, or a thin rectangle), 4 quarter markers "Q1"–"Q4" with milestone stickies above and below.
   - **User journey map** (Strategy): a frame with stage columns "Discover, Consider, Buy, Use, Recommend" (text headers) and rows "Actions", "Thoughts", "Feelings", "Opportunities" (row label texts, stickies in the cells).
   - **Business model canvas** (Strategy): the 9 classic blocks as frames in the standard layout (Key partners, Key activities, Key resources, Value propositions, Customer relationships, Channels, Customer segments, Cost structure, Revenue streams).
   - **Weekly planner** (Planning): frames "Monday"–"Friday" plus a "Notes" doc card.
2. **"Stack contents" command** (`commands/arrange.ts`): with one frame selected (or from the frame's context menu), stacks its non-connector children in a column, ordered by their current y (then x), 16 px from the top under the title, 12 px apart, left-aligned to the frame's padding, widths unchanged. One undo step. Hidden when the selection isn't a single frame with children. No layout runs by itself.
3. Featured on the start page: Kanban, Flowchart, Brainstorm, Meeting notes (the row shows 4; the rest are in "More templates").

## Files
- create: `src/lib/templates/{kanban,retrospective,swot,eisenhower,mindMap,timeline,journeyMap,businessModelCanvas,weeklyPlanner}.ts`
- modify: `templates/index.ts`, `templates/builder.ts` (helpers if needed, e.g. `columnFrames`), `commands/arrange.ts`, context menu / Arrange menu

## Tests
- `templates.test.ts` (extend; runs over every registered template): every element parses; connector endpoints exist; frame children are inside their frame; no two stickies overlap inside a frame; templates fit in 4,000 × 3,000.
- `arrange.test.ts`: stack contents orders by y, keeps x padding and widths, ignores connectors, is one undo step, and does nothing for a frame without children.
- e2e: insert Kanban, drag a sticky from "To do" to "Done" → its `parentId` becomes the Done frame; "Stack contents" on Done stacks it under the existing card.
- Visual snapshot of the gallery (one per template preview is overkill: one grid screenshot).

## Acceptance criteria
- [ ] `pnpm verify` and `pnpm test:e2e` pass
- [ ] Every template looks tidy in light and dark mode (screenshots noted in PROGRESS)
- [ ] Each template module is its own lazy chunk

## Out of scope
Smart widgets with automatic layout (a kanban that re-stacks itself while you drag): that needs a new element type and is a non-goal today.

## Commit
`feat(templates): add kanban, retrospective, SWOT, Eisenhower, mind map, timeline, journey map, business model canvas and weekly planner`
