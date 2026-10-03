# Step 46 — Waystones

Phase: K. Writers · Depends on: 43 · Estimate: 1.5 days

> **Approved by the human (2026-10-04), for the board only (not in doc cards):** adds a `waystone` element type and schema version 7 (or 6 if built together with step 45).

## Goal
Waystones are named checkpoints placed on a page. A waystone bar steps through them in order — previous / next, or pick from the list — and the view flies to each one at its saved zoom. Good for long story maps, presenting a board, or getting back to the important places of a huge page.

## Proposed data model (for approval)
```ts
interface WaystoneElement extends BaseElement {   // w/h fixed 32 × 40 (a pin), not resizable or rotatable
  type: 'waystone';
  name: string;        // "Act II", "Villain's lair"…
  zoom: number;        // the zoom to arrive at (clamped to ZOOM_MIN..ZOOM_MAX)
  order: string;       // fractional index: route order on the page (separate from z)
}
```
Waystones are board objects (per page, undoable, movable, connectable). They live on the canvas only: they aren't @-mentionable and never appear inside doc cards. Exports leave them out unless "Include waystones" is ticked.

## Tasks
1. Model: type, zod schema, defaults, migration; registry entry (pin view with its number and name label, constant on-screen size like handles; not resizable/rotatable).
2. **Create:** a "Waystone" tool (**W**; on phones in "Insert more") — tap to place; or "Add waystone here" in the waystone bar, which places one at the view centre with the current zoom. New ones go to the end of the route.
3. **Navigate:** a waystone bar (bottom centre, above the status bar; hidden when the page has none): ◀ "2 / 5 · Act II" ▶, the name opens the list (rename, reorder by drag or Alt+↑/↓, delete, "Update zoom to current view"). Keys: **PageDown / PageUp** next / previous (also Alt+→ / Alt+←), **Alt+1…9** jump. Flying uses `viewport.animateTo` (respects reduced motion) to centre the waystone at its zoom. The route wraps around (setting).
4. Presenting: in full screen with focus mode's "hide interface" style, the waystone bar stays as the only control (a lightweight presentation mode).

## Tests
- Unit: schema/migration; route order with fractional keys; next/previous with wrap; fly target viewport (centre + clamped zoom).
- e2e `waystones.spec.ts`: place three waystones with W (different zooms) → bar "1 / 3" → PageDown flies to the second at its zoom → Alt+3 → reorder in the list → order persists after reload; phones: Insert more → Waystone, bar buttons ≥ 44 px.

## Acceptance criteria
- [ ] `pnpm verify` and `pnpm test:e2e` pass
- [ ] `00-architecture.md` §5 (type, schema version), §11 (W, PageDown/PageUp, Alt+1…9)

## Commit
`feat(waystones): named checkpoints to fly between on a page`
