# Step 54 — Widget framework and timer

Phase: M. Widgets · Depends on: 53 · Estimate: 2.5 days

> **Approved by the human (2026-10-11):** one generic `widget` element type with a `kind`, schema version 8, a `widgets` Y.Doc map for per-person entries, and a `WIDGET` transaction origin. New widgets go into the toolbar's dropdowns, grouped by work direction. Update `00-architecture.md` (§5 types, Y.Doc layout and rules, §6 origins and localPrefs, §9 registry and ToolId, §11 keys) in the same commit.

## Goal
Small interactive objects ("widgets") can be placed on the board: they have their own buttons that work with one click, their state is shared with everyone on a live board, and new kinds can be added later without another schema change. The first widget is a **timer** (countdown or stopwatch).

## Read first
- `00-architecture.md` §3 (D4, D6, D10), §5, §6 (origins, localPrefs), §9, §14 (live sharing)
- `src/lib/model/{types.ts, schema.ts, migrations.ts, defaults.ts, ops.ts, origins.ts, comments.ts}` (how a side map is created, copied and deleted with its element)
- `src/lib/board/elements/{registry.ts, index.ts}`, `src/lib/board/elements/media/*` (an element with its own interaction)
- `src/lib/board/tools/{select.svelte.ts, waystone.ts, toolManager.svelte.ts}`, `src/lib/board/ui/Toolbar.svelte` (the Shapes flyout and the phones' Insert menu)
- `src/lib/board/render/{staticSvg.ts, canvasScene.ts}`, `src/lib/board/commands/clipboard.ts`
- `src/lib/storage/live/clock.ts` (clock skew), `src/lib/board/ui/LiveAnnouncer.svelte`

## Data model
```ts
export type WidgetKind =
  | 'timer'                                   // step 54
  | 'wheel' | 'randomizer' | 'dice'           // step 55
  | 'vote' | 'counter'                        // step 56
  | 'progress' | 'status' | 'deadline'        // step 57
  | 'wordgoal' | 'sprint' | 'generator';      // step 58

export interface WidgetElement extends BaseElement {   // schema version 8
  type: 'widget';
  kind: string;      // a WidgetKind; unknown kinds (from a newer app) are kept and shown as a placeholder
  title: string;     // ≤ 100 chars; '' = the kind's label
  config: unknown;   // JSON, per-kind zod schema; what the user set up (undoable, LOCAL)
  state: unknown;    // JSON, per-kind zod schema; what happens while it runs (WIDGET origin, not undoable)
}
```
- `ElementType` gains `'widget'`. Schema version 8, no data moves. The bump keeps older apps from opening boards with widgets: they would drop them from their view.
- `config` and `state` are plain JSON values replaced as a whole (like `style`). Each kind parses them with its own zod schema plus `.catch(default)`, so a bad or older value shows defaults and is never thrown away by a read.
- **New Y.Doc map `widgets`:** `Y.Map<widgetId, Y.Map<participantId, JSON>>`. It holds input that many people add at the same time (votes, counter clicks; first used in step 56), so peers don't overwrite each other. It is deleted with its element in the same transaction (a `beforeDeleteHooks` entry). Copies start empty, because a copied vote starts fresh. It is in canvas undo scope.
- **New origin `WIDGET`:** state writes (start, pause, spin, roll, vote) are local but not undoable. Undo stays about editing the board. Config edits and creation use `LOCAL`.
- **Participant id:** `spacy:participantId` (localPref, `nanoid(12)`, created on first use). The display name is the comment author name, as presence uses it.
- **Time:** state stores absolute times (`startedAt`, epoch ms), never ticking values, so every tab and peer computes the same display. `widgets/clock.ts` `now()` = `Date.now()` corrected by `clockSkewMs` (measured once while the board is live). Without a server date, plain `Date.now()`.

## Tasks
1. **Model:** the type, the zod schema (`kind` is any string ≤ 32 chars, `title` ≤ 100), defaults, migration to version 8, the `WIDGET` origin. `src/lib/model/widgets.ts` with the only write helpers: `createWidget`, `setWidgetConfig` (LOCAL), `setWidgetState` (WIDGET), `setWidgetEntry` / `clearWidgetEntries` (WIDGET), and the delete hook. The `widgets` map is copied by clipboard and duplicate as empty, and it is part of `.spacy` files like the rest of the Y.Doc.
2. **Widget catalog** (`src/lib/board/widgets/catalog.ts`): one entry per kind: `{ kind, label, group: 'Facilitation' | 'Team' | 'Writing', icon, size, keepAspect, configSchema, stateSchema, defaultConfig, component, settings (popover component), actions, staticSvg }`. `actions(el, size)` returns the clickable zones in local coordinates: `{ id, rect, label, primary? }[]`. Steps 55–58 only add entries; the framework doesn't change.
3. **Registry entry** for `widget`: the box is used for hit-testing and connections. It is resizable, and its content scales with the box (each view draws in an SVG `viewBox` or with container units). Rotatable is false. `editableText` is false. A double-click opens the settings. Unknown kinds render a gray box saying "This widget needs a newer version of Spacy", and the element is kept as is.
4. **Interaction** (registry gains an optional `actionAt(el, p): string | null`, §9):
   - Select tool: a press on an action zone that ends without dragging (≤ 4 px) runs the action instead of changing the selection. A drag still moves the widget. Hover over a zone shows the pointer cursor and the zone's label as a tooltip.
   - With one widget selected: **Space** or **Enter** runs its primary action; **Shift+Enter** (or double-click, or "Widget settings" in the context menu and the phones' long-press menu) opens the settings popover anchored to the element.
   - A locked widget still runs its actions (start/pause on a locked timer is expected), but its settings are read-only.
   - Results are announced through `LiveAnnouncer` ("Timer finished").
5. **Ticker** (`widgets/ticker.svelte.ts`): one shared `requestAnimationFrame` loop, running only while a visible widget needs it (a running timer). It updates a reactive `now` at most 10 times a second. Culled widgets don't subscribe.
6. **Toolbar — Widgets dropdown:** a new flyout button in the Insert group, after Sticky note, built like the Shapes flyout. It has group headings **Facilitation**, **Team** and **Writing**, and each item shows the kind's icon and label. Pick an item → the `widget` tool (`ToolId` gains `'widget'`, with `tools.widgetKind`). Click places the widget at its default size; dragging an item from the menu onto the canvas works like shapes (`WIDGET_DRAG_TYPE`). The button shows the last used kind's icon. On phones, the same groups appear in the Insert menu. In this step only "Timer" (Facilitation) is listed.
7. **Timer** (`widgets/timer/`):
   - Config: `{ mode: 'countdown' | 'stopwatch', duration: number /* s, 1..86 400 */, sound: boolean }`. The default is a 5-minute countdown with sound.
   - State: `{ startedAt: number | null, elapsed: number /* ms banked before startedAt */ }`. Running = `startedAt !== null`. Remaining = `duration − (elapsed + now − startedAt)`, clamped at 0.
   - View: a large mm:ss (h:mm:ss over an hour) and a progress ring. Buttons: start/pause (primary), reset, and "+1 min" / "−1 min" for countdowns. In the last 10 s the ring turns `--danger`. At 0 it shows "Time's up" and pulses once (no pulse with reduced motion).
   - End: every open tab that shows the board plays a short chime (WebAudio oscillator, no asset) if `sound`, once per run per tab. The board's sound mute (if media prefs have one) applies.
   - Settings: mode, duration (minutes + seconds fields), quick presets (1, 3, 5, 10, 15, 25 min), sound, title.
8. **Other surfaces:** static SVG / PNG export, thumbnails and the scene canvas draw each kind's `staticSvg(el, now)`. A timer shows the time left when exported. Markdown export and compile skip widgets. Find & replace searches widget titles only. Comments and connectors work on widgets like on any element.

## Files
- create: `src/lib/model/{widgets.ts, widgets.test.ts}`, `src/lib/board/widgets/{catalog.ts, clock.ts, ticker.svelte.ts, actions.ts, actions.test.ts, WidgetSettingsPopover.svelte, UnknownWidget.svelte}`, `src/lib/board/widgets/timer/{TimerView.svelte, TimerSettings.svelte, timer.ts, timer.test.ts, chime.ts}`, `src/lib/board/elements/widget/{WidgetView.svelte, index.ts}`, `src/lib/board/tools/widget.ts`
- modify: `model/{types,schema,defaults,migrations,origins,ops,clone}.ts`, `elements/{registry,index}.ts`, `tools/{types,select.svelte,toolManager.svelte}.ts`, `ui/{Toolbar,CanvasContextMenu}.svelte`, `render/{staticSvg,canvasScene}.ts`, `commands/clipboard.ts`, `shared/localPrefs.ts`, `00-architecture.md`

## Tests
- `schema.test.ts` / `migrations.test.ts`: widget round-trip, unknown kind kept, v7 → v8.
- `widgets.test.ts`: state writes aren't undone by undo, but config writes are; deleting a widget removes its `widgets` entries in the same transaction, and undo restores them; a copy has empty entries.
- `timer.test.ts` (pure, fake `now`): remaining/elapsed for start, pause, resume, ±1 min, reset; countdown clamps at 0; stopwatch counts up; a skewed clock shows the same remaining time once corrected.
- `actions.test.ts`: zone lookup at different box sizes; click vs. drag threshold.
- e2e `widgets.spec.ts`: Widgets dropdown → Timer → click places it; a click on start runs it (the time decreases over about 1.2 s); Space pauses; Ctrl+Z after start removes nothing but the last board edit; Shift+Enter opens settings → 1 min preset; reload keeps a running timer running at the right time. Live: in `live.spec.ts`, B sees A's timer start and the same remaining time (±1 s).
- `staticSvg.test.ts` snapshot with a timer.

## Acceptance criteria
- [x] `pnpm verify` and `pnpm test:e2e` pass (Firefox `home.spec.ts` lifecycle flake fails the same without this step; WebKit CI only)
- [x] Start/pause/reset are one click and never enter undo history
- [ ] A widget of an unknown kind survives open, edit, copy, export and save untouched (unit-checked: parse, placeholder, no actions; not run through a saved board)
- [ ] No idle animation frames when no running timer is visible (by design: the ticker runs only while a mounted widget holds it; not measured with the performance fixture)
- [x] `00-architecture.md` updated (type, schema 8, `widgets` map, `WIDGET` origin, `spacy:participantId`, ToolId `widget`, keys; zones are handled by the select tool instead of a registry `actionAt`)

## Out of scope
The other kinds (steps 55–58), templates using widgets (59–60), alarms when the board isn't open, notifications, a timer in the status bar, timer sounds to choose from.

## Commit
`feat(widgets): widget framework and a shared timer`
