# Step 28 — Templates

Phase: G. Sharing · Depends on: 27 · Estimate: 1.5 days

## Goal
Three built-in templates (Flowchart, Brainstorm, Meeting notes) built programmatically, shown on the start page next to "New board" with live previews. **Milestone M6.**

## Read first
- `src/lib/model/ops.ts`, `src/lib/board/diagram/ops.ts`, `src/lib/board/doccards/editorFactory.ts`, `src/lib/board/render/staticSvg.ts`
- `src/lib/home/TemplatesRow.svelte`

## Tasks
1. **Template registry** `src/lib/templates/index.ts`:
   ```ts
   export interface Template { id: string; name: string; description: string; build(doc: Y.Doc): void | Promise<void> }
   export const templates: Template[];
   export async function createBoardFromTemplate(t: Template): Promise<BoardMeta>
   ```
   `createBoardFromTemplate`: `boardsRepo.create({ title: t.name })` → temp `Y.Doc` → `migrate` → `t.build(doc)` (all writes with origin `TEMPLATE`) → `writeSnapshot`. Then render and save a thumbnail (reuse `renderThumbnail` logic with a doc-based lookup) so the card has a preview immediately.
2. **Doc card content helper** `src/lib/templates/docContent.ts`: `setDocContent(fragment, json: JSONContent)`, using the collaboration library's `prosemirrorJSONToYXmlFragment(schema, json, fragment)` (from y-prosemirror or `@tiptap/y-tiptap`, whichever step 23 installed) with `schema = getSchema(docExtensions(...))` from `@tiptap/core`. It's lazy-imported, so TipTap stays out of the home bundle until a template is used.
3. **Templates** (use real connectors via `createConnector`; frames containing their children with `parentId` set):
   - **Flowchart** (`flowchart.ts`): a frame "Flowchart"; terminator "Start" → process "Step 1" → decision "OK?" → (Yes, down) process "Step 2" → terminator "End"; decision (No, right) → an elbow back to "Step 1" with the label "No"; the Yes connector labelled "Yes". Vertical layout with a 60 px gap, and a consistent quick style (Blue for processes, Yellow for the decision).
   - **Brainstorm** (`brainstorm.ts`): a frame "Brainstorm"; a central ellipse "Topic" (Violet); 6 stickies around it in a circle (radius 320) in all 6 sticky colors with the prompts "Idea", "Question", "Risk", "Goal", "Resource", "Next step"; curved connectors without markers from the center to each; a text "Brainstorm: <topic>" above.
   - **Meeting notes** (`meetingNotes.ts`): a doc card "Meeting notes" (480×560) with H1 "Meeting notes", "Date: …", H2 Attendees + bullets, H2 Agenda + a numbered list, H2 Notes + a paragraph, H2 Action items + a checklist of 3; a frame "Decisions" to its right with 3 stickies; an elbow connector from the doc card to the frame labelled "decisions".
4. **Previews:** `TemplatesRow` shows a card for each template with its name and description. The preview image is rendered at runtime: build the template into an in-memory `Y.Doc` (no persistence), `renderStaticSvg` → an SVG data URL, cached in a module-level `Map` for the session. Show a skeleton until ready. Lazy-load the template modules when the row first becomes visible.
5. Click a template card → `createBoardFromTemplate` → navigate to the board.

## Files
- create: `src/lib/templates/{index.ts, docContent.ts, flowchart.ts, brainstorm.ts, meetingNotes.ts, preview.ts}`, `src/lib/home/TemplateCard.svelte`
- modify: `TemplatesRow.svelte`, `HomePage.svelte`

## Tests
- `templates.test.ts`: for each template, build into a fresh doc → every element passes `parseElement`; every connector endpoint references an existing element; every frame child is fully inside its frame; the meeting notes doc card fragment contains "Action items".
- `tests/e2e/templates.spec.ts`: click "Flowchart" → the board opens with ≥ 5 shapes and ≥ 5 connectors (`[data-type="connector"]`); back home → the new board card has a thumbnail.

## Acceptance criteria
- [x] `pnpm verify` and `pnpm test:e2e` pass
- [x] Templates look tidy (manual screenshots noted in PROGRESS)
- [x] The home route bundle doesn't include TipTap (check the build output chunks)
- [x] **M6 demo:** export/import, backup, templates

## Out of scope
User-defined templates ("Save as template") — later.

## Commit
`feat(templates): add flowchart, brainstorm and meeting notes templates with previews`
