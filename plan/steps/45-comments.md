# Step 45 — Comments

Phase: K. Writers · Depends on: 44 · Estimate: 2.5 days

> **Approved by the human (2026-10-04):** lifts the "comments" non-goal, adds a `comments` map, a `comment` text mark and schema version 6.

## Goal
Comment threads on **any object** (a sticky, a shape, a frame, an image, a connector, media…) and on **ranges of text** inside doc cards. Comments can be replied to, resolved and reopened, listed in a panel, and they travel with the board in `.smthng` files. No accounts: the author is a name you set once (per browser).

## Proposed data model (for approval)
```ts
doc.getMap('comments'): Y.Map<threadId, Y.Map<{
  anchor: { kind: 'element'; elementId: string } | { kind: 'text'; cardId: string };
  page: string;              // page id (navigation)
  resolved: boolean;
  createdAt: number;
  messages: Y.Array<{ id: string; author: string; text: string; at: number; editedAt?: number }>;
}>>
```
- Text anchors are a ProseMirror **`comment` mark** (`threadId` attribute) in the doc card schema, so the highlighted range moves with edits. Schema version 6: an older editor deletes text carrying marks it doesn't know.
- Deleting an element deletes its element-anchored threads (same transaction); deleting all of a thread's marked text leaves the thread as "orphaned" (shown in the panel with its quote).
- Comments are in canvas undo scope (creating/deleting a thread, resolving); message edits are too.
- `.smthng` export/import carries the map (ids remapped with elements on import and paste; pasting a commented object copies its threads).

## Tasks
1. Model ops (`model/comments.ts`): create thread (element or text), reply, edit, delete message, resolve/reopen, delete thread; hooks on element delete and clone.
2. Element comments: a comment badge (count) at the object's top-right, in screen space; context menu "Comment" (Mod+Alt+M); a thread popover (on phones a bottom sheet).
3. Text comments: select text in a doc card → bubble menu "Comment" → the range gets the mark; hovering/clicking the highlight opens its thread; focus mode shows comments in the margin.
4. Comments panel (toggle, like the outline): all threads on the page, filter open/resolved, sorted by position; click flies to the object/range.
5. Author name: asked the first time you comment, editable in Settings (`localPrefs`).
6. Exports: PNG/SVG and compile leave comments out; Markdown export optionally as footnotes.

## Tests
- `comments.test.ts`: ops, delete/clone hooks, undo, orphaning, import remap.
- `migrations.test.ts`: v5 → v6.
- e2e `comments.spec.ts`: comment on a sticky → badge → reply → resolve (badge hides, panel shows it under Resolved) → reopen; comment a text range in a doc card → highlight → edit text around it → highlight follows; delete the sticky → its thread is gone; export + import a `.smthng` → comments come back; phones: long-press → Comment → sheet.

## Acceptance criteria
- [x] `pnpm verify` and `pnpm test:e2e` pass
- [x] `00-architecture.md`: non-goal lifted, §5 comments map and mark, schema 6, §10 file format note

## Out of scope
Mentions of people, notifications, real-time presence (no accounts, no server).

## Commit
`feat(comments): comment threads on any object and on text in doc cards`
