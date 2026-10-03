# Step 43 — Backlinks

Phase: K. Writers · Depends on: 39 · Estimate: 1 day

## Goal
Every mentionable object shows where it's mentioned: a "Mentioned in…" list for characters, places, scenes, frames, and media, so doc cards work like a small wiki.

## Read first
- `src/lib/board/doccards/{mentions.ts, jumpTo.ts, fragmentJson.ts}`, `src/lib/board/elements/doccard/DocCardHeader.svelte`

## Tasks
1. `doccards/backlinks.ts`: an index `targetId → { cardId, snippet }[]` built from the `docs` fragments (mention nodes), kept up to date by observing `docs` (debounced) across all pages; snippets are ~80 characters around the mention.
2. UI: a count badge in the doc card header ("↩ 3"), a "Mentioned in" section in focus mode, and a "Backlinks" entry in the context menu / style bar for any mentioned object. The list shows card title + snippet; click opens the card at the mention (existing jump-to with the mention highlighted).
3. Mentions to deleted objects show as "missing" in the source card (existing behaviour) and don't appear in any list.

## Tests
- `backlinks.test.ts`: index build, updates on edit/delete, multiple mentions in one card, cross-page.
- e2e: a character card mentioned from two scene cards → badge "2" → list → click opens the right scene with the mention highlighted.

## Acceptance criteria
- [ ] `pnpm verify` and `pnpm test:e2e` pass

## Commit
`feat(writing): backlinks — see where each object is mentioned`
