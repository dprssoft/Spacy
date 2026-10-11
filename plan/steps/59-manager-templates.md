# Step 59 — Templates for managers

Phase: M. Widgets · Depends on: 56, 57 · Estimate: 1.5 days

## Goal
Templates for team leads and project managers, some with widgets already placed, in a new **Management** category of the template gallery.

## Read first
- `src/lib/templates/{index.ts, builder.ts, kanban.ts, retrospective.ts}`, step 34
- `src/lib/model/widgets.ts` (`createWidget` for template builders, origin `TEMPLATE`)

## Tasks
1. `TemplateCategory` gains `'Management'`, placed after 'Planning'. The gallery's category filter shows it.
2. Templates (one module each under `src/lib/templates/`, with keywords for search):
   - **OKRs**: 3 objective frames, each with 3 key-result rows (a text and a progress widget each).
   - **RACI matrix**: a grid of tasks × roles built from rectangles, R/A/C/I stickies, and a legend.
   - **Roadmap (Now / Next / Later)**: three frames with starter stickies and a deadline widget for each column.
   - **1:1 meeting**: a doc card with an agenda, notes and action items (a checklist), next to a progress widget linked to it.
   - **Risk register**: rows of risk stickies with a status chip each (Open / Mitigating / Closed / Accepted), plus likelihood × impact as a 3 × 3 grid.
   - **Stakeholder map**: a power × interest 2 × 2 (Manage closely, Keep satisfied, Keep informed, Monitor).
   - **Sprint planning**: a goal text, frames Backlog / Sprint / Capacity, a deadline (sprint end) and a counter (story points).
   - **Decision log**: a doc card table-like list (date, decision, owner, why), with a status chip per open decision.
   - **Lean canvas**: the 9 blocks in the standard layout.
3. Featured stays as it is; these are in "More templates".

## Files
- create: `src/lib/templates/{okrs,raci,roadmap,oneOnOne,riskRegister,stakeholderMap,sprintPlanning,decisionLog,leanCanvas}.ts`
- modify: `templates/index.ts`, `templates/builder.ts` (a `widget()` helper), `home/*` category filter if it lists categories explicitly

## Tests
- `templates.test.ts` (existing, runs over all templates): each new template builds, every element is schema-valid, widgets have valid configs, linked ids exist.
- e2e: insert "OKRs" into a board → 9 progress widgets are present.

## Acceptance criteria
- [ ] `pnpm verify` and `pnpm test:e2e` pass
- [ ] All new templates have gallery previews rendering their widgets

## Out of scope
Gantt charts, resource planning, data import from Jira or other tools.

## Commit
`feat(templates): OKRs, RACI, roadmap and other templates for managers`
