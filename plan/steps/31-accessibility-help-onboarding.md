# Step 31 — Accessibility, help, onboarding

Phase: H. Release · Depends on: 30 · Estimate: 1.5 days

## Goal
Keyboard-complete and screen-reader-friendly UI, a shortcuts dialog, a help menu, first-run tips, a dark mode audit and reduced-motion support.

## Read first
- `00-architecture.md` §11 (shortcuts)
- `src/lib/board/tools/shortcuts.ts` (the registry), `Toolbar.svelte`, `StylePopover.svelte`

## Tasks
1. **Automated a11y checks:** `pnpm add -D @axe-core/playwright`. `tests/e2e/a11y.spec.ts`: run axe on the start page (with boards), the empty start page, a board with elements selected (popover open), focus mode, the export dialog and the settings menu. Zero `serious` or `critical` violations (exclude the canvas world layer internals with a documented `exclude` selector if needed).
2. **Toolbar:** roving tabindex with arrow keys (a single tab stop), `aria-pressed` on tools, `aria-label` = "Rectangle (R)". The flyouts are menus with correct roles.
3. **Canvas semantics:**
   - The container has `role="application"`, `aria-roledescription="whiteboard"`, and `aria-describedby` pointing to a visually hidden help text ("Use tools from the toolbar. Press ? for keyboard shortcuts.").
   - A live region (`aria-live="polite"`, visually hidden) announces: the tool changes ("Rectangle tool"), the selection changes ("2 elements selected: rectangle, sticky note"), and create/delete ("Sticky note created").
   - **Keyboard-only creation:** with a creation tool active and the canvas focused, `Enter` creates the element at the viewport center (shape, sticky, text, doc card, frame) and selects it.
   - **Keyboard selection:** `Tab` / `Shift+Tab` while the canvas is focused and nothing is being edited cycles the selection through visible elements in reading order (top-to-bottom, left-to-right by AABB), panning to keep the selection visible.
   - Connector creation by keyboard: with one element selected, `Mod+Alt+Arrow` (quick-create, step 22) covers it. Mention this in the help.
4. **Focus visibility:** a consistent `focus-visible` ring (2 px `--accent`, offset 2) on all interactive elements, including cards on the start page and the popover controls.
5. **Shortcuts dialog** `src/lib/board/ui/ShortcutsDialog.svelte` (`?` = `Shift+/`): generated from the shortcut registry, grouped by `group`, with platform-correct key labels (⌘ ⌥ ⇧ on macOS; Ctrl, Alt, Shift elsewhere) via `formatKeys(keys)`. It has a search filter.
6. **Help menu:** a "?" button bottom-right next to the zoom controls → Keyboard shortcuts · Show tips again · About.
7. **Onboarding tips** `src/lib/board/ui/Onboarding.svelte`: on the first board open (`localPrefs` `onboarded` false), show 3 sequential popover tips anchored to: the toolbar ("Pick a tool, or press R, S, T. Double-click the canvas to write."), the connector tool ("Hover any object and drag from its dots to connect it to anything."), and the doc card tool ("Press N for a doc card; press ⌘/Ctrl+Enter to open it full screen."). "Next" / "Skip" buttons; the last one sets `onboarded`. "Show tips again" resets it.
8. **Dark mode audit:** go through every UI surface and element type in dark mode. Element colors stay the same as authored, except that the default dark stroke and text (`#1e1e1e`) render as `#e9e9ee` on the canvas in dark mode for shapes, text and connectors (a render-time mapping only, never written to data; exports use the authored colors). Sticky text always stays dark. Record the audit in PROGRESS.
9. **Reduced motion:** `prefers-reduced-motion: reduce` → `animateTo` is instant, the pulse highlight is static, and card hover lifts are disabled.
10. **Touch basics:** on coarse pointers, handles are 14 px and the toolbar has larger hit targets.

## Files
- create: `src/lib/board/ui/{ShortcutsDialog.svelte, HelpMenu.svelte, Onboarding.svelte, LiveAnnouncer.svelte}`, `src/lib/board/tools/formatKeys.ts`, `tests/e2e/a11y.spec.ts`
- modify: `Toolbar.svelte`, `Canvas.svelte`, `select.ts` (Tab cycling), the creation tools (Enter), `SelectionOverlay.svelte`, `viewport.svelte.ts`, element views (the dark mapping), `app.css`

## Tests
- `formatKeys.test.ts`: mac vs non-mac output.
- `readingOrder.test.ts`: the Tab cycling order.
- `tests/e2e/a11y.spec.ts` (above).
- `tests/e2e/keyboard-only.spec.ts`: without the mouse: focus the canvas → R → Enter creates a rect → Enter edits the text → type → Escape → ArrowRight ×10 moves it by 10 px → `?` opens the shortcuts dialog → Escape closes it.

## Acceptance criteria
- [ ] `pnpm verify` and `pnpm test:e2e` pass (including axe)
- [ ] The whole start page and the core board flows are usable with the keyboard only (manual)
- [ ] VoiceOver or NVDA announces tool and selection changes (manual spot check, noted in PROGRESS)

## Out of scope
Full screen-reader navigation of diagram semantics (the graph structure).

## Commit
`feat(a11y): add keyboard-only flows, live announcements, shortcuts dialog and onboarding tips`
