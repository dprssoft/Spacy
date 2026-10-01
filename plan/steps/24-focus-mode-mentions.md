# Step 24 — Focus mode, formatting menus, mentions

Phase: F. Doc cards · Depends on: 23 · Estimate: 2 days

## Goal
A full-page focus editor for doc cards (linkable with `?doc=<id>`), a bubble formatting menu, `/` slash commands, and `@`-mentions of canvas objects that jump to them.

## Read first
- `src/lib/board/doccards/editorFactory.ts`, `DocCardView.svelte`
- `src/lib/board/viewport.svelte.ts` (`animateTo`)

## Tasks
1. **Focus mode** `src/lib/board/doccards/FocusMode.svelte`:
   - A full-viewport overlay (`fixed inset-0 z-50 bg-surface`) with a top bar (48 px): a back button "← Board", the card title (`InlineEditable`), and a close (X) button. A body column `max-w-[760px] mx-auto px-6 py-10` with a larger typography scale (base 17 px).
   - Its own editable editor on the same fragment. While focus mode is open, the canvas card's editor stays read-only.
   - **Open:** the card header "Open" button, `Mod+Enter` with a card selected, or double-click the card header area.
   - **URL:** opening does `goto(`?doc=${id}`, { noScroll: true, keepFocus: true })` (push). Closing does `history.back()` if we pushed it, else `goto(page.url.pathname, { replaceState: true })`. A `$effect` on `page.url.searchParams.get('doc')` opens or closes the overlay, so the browser back button closes focus mode and deep links work.
   - An unknown `doc` id → toast "Doc card not found" and strip the parameter.
   - Escape closes (unless a suggestion popup is open). Focus is trapped in the overlay, and focus returns to the canvas on close.
2. **Bubble menu** (TipTap bubble-menu extension, in both the inline card editor and focus mode): shown on a non-empty text selection. Buttons: Bold, Italic, Strike, Code, Link (a small input popover: URL, Enter to apply, empty to remove), H1, H2, H3. Rendered as a Svelte component whose root element is passed to the extension. `data-interactive`.
3. **Slash commands** `src/lib/board/doccards/slash.ts` (the TipTap suggestion utility, char `/`, only at the start of a block or after a space):
   - Items: Heading 1, Heading 2, Heading 3, Bullet list, Numbered list, Checklist, Quote, Code block, Divider. Filter by query (case-insensitive prefix/substring).
   - Popup: `SuggestionList.svelte` mounted with `mount()` into `document.body`, positioned from `clientRect()` (below the caret, flipping above near the bottom). Keyboard: ArrowUp/Down, Enter, Escape. `unmount()` on exit.
4. **Mentions** `src/lib/board/doccards/mentions.ts` (the TipTap mention extension, char `@`):
   - `mentionItems(store, query): { id, label, type }[]`: frames (title), doc cards (title), shapes/stickies/texts with non-empty text (the first 40 characters, single line). Ranked by prefix match, then substring; max 8.
   - The same `SuggestionList` popup with type icons.
   - Node attributes `{ id, label }`, rendered as a chip `@label` (`.mention` class: accent text, subtle accent background, radius 4).
   - **Click a chip** (in either editor, via a `handleClickOn` plugin prop or a delegated click listener on `.mention[data-id]`): if focus mode is open, close it; then `viewport.animateTo(fitRect(aabb(el), size, 120, 1))`, `selection.set([id])`, and a 1 s pulse highlight in the overlay (`PulseHighlight.svelte`). A missing element → the chip is styled with a strikethrough (via a decoration or a CSS class set at render) and clicking shows the toast "This object was deleted".
   - The label is stored at insert time; it's not live-updated (document it).
5. `Mod+Enter` and the "Open" button in the card header are now visible and wired.
6. Register shortcuts in the registry (group "Doc") so they show up in the step 31 help dialog: Mod+Enter (open focus), Mod+B/I/Shift+X/E (the TipTap defaults, listed for reference only).

## Files
- create: `src/lib/board/doccards/{FocusMode.svelte, BubbleMenu.svelte, LinkPopover.svelte, SuggestionList.svelte, slash.ts, mentions.ts}`, `src/lib/board/canvas/PulseHighlight.svelte`
- modify: `editorFactory.ts` (accept extra extensions: bubble menu element, slash, mentions with a store lookup), `DocCardView.svelte`, `DocCardHeader.svelte`, `BoardWorkspace.svelte`, `shortcuts.ts`

## Tests
- `mentions.test.ts`: `mentionItems` ranking, limit, excludes empty texts and connectors.
- `slash.test.ts`: filtering.
- `tests/e2e/focus-mentions.spec.ts`:
  - Create a card → Mod+Enter → the URL contains `?doc=` → type text → browser back → the overlay is closed and the card shows the text → browser forward → the overlay reopens.
  - Type `/head` → Enter → an H1 is inserted.
  - Create a sticky "Login flow" → in the card type `@Log` → Enter → a chip exists → click the chip → the sticky is selected (via hooks) and the viewport centered on it.

## Acceptance criteria
- [x] `pnpm verify` and `pnpm test:e2e` pass
- [x] Deep link `/board/<id>?doc=<cardId>` opens focus mode directly after load
- [x] Popups never render off-screen

## Out of scope
Markdown export (step 25); comments (never, in this version).

## Commit
`feat(doccards): add focus mode, bubble menu, slash commands and object mentions`
