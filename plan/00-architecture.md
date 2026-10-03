# SMTHNG — Architecture

This document is the contract every step builds on. Steps may refine details, but must not contradict it without human approval (see `CLAUDE.md`).

## 1. Product summary

- **Whiteboard first:** infinite canvas, pan/zoom, freehand pen, shapes, sticky notes, text, images, frames.
- **Diagram add-on:** every object can be connected by connectors that stay attached (ports, floating, or fixed anchors); straight / elbow / curved routing; arrowheads; labels; basic styling; quick-create; small flowchart shape library.
- **Doc cards add-on:** rich-text cards on the canvas (headings, lists, checklists, quotes, code, links), full-page focus mode, `@`-mentions of canvas objects, Markdown export.
- **Media:** YouTube, Vimeo and audio/video links play in place on the board (click-to-play: nothing is requested from a provider before play).
- **Templates:** a gallery of built-in layouts (kanban, retrospective, SWOT, mind map…) for new boards or inserted into the current one.
- **Start page:** Figma-like home with "New board", templates, Recent / Starred / All / Trash, search, sort, grid/list, thumbnails.
- **No backend.** Data lives in IndexedDB. Sharing = `.smthng` file export/import + PNG/SVG/Markdown export. Installable, offline-capable PWA.
- Real-time multi-user collaboration is **not** in scope, but the data layer (Yjs) is chosen so a sync server can be added later by changing only `openBoard()`.

### Non-goals (do not build)
Accounts, server sync, comments, version history, UML/BPMN libraries, auto-layout, swimlanes, gradients, user-uploaded fonts (a fixed set of 10 bundled open-licence fonts plus system stacks is offered), custom shape editor, frame clipping, nested frames, nested groups, connector-to-connector junctions, line jumps, page/print layout, tables/images inside doc cards, suggestion mode, mobile editing (mobile/touch: view + basic pan/zoom only).

## 2. Tech stack

| Concern | Choice |
|---|---|
| Framework | SvelteKit 2, Svelte 5 (runes), TypeScript strict |
| Build/deploy mode | SPA: `@sveltejs/adapter-static` with `fallback: 'index.html'`, root `+layout.ts` → `ssr = false`, `prerender = false` |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`), CSS variables for theme tokens |
| Headless UI | `bits-ui` (dropdown, context menu, dialog, alert dialog, popover, tooltip, select) |
| Icons | `@lucide/svelte` |
| Toasts | `svelte-sonner` |
| Board data | `yjs`, `y-indexeddb` |
| Metadata/assets | `idb` |
| Rich text | TipTap v3 (`@tiptap/core`, `@tiptap/starter-kit`, collaboration, list, link, placeholder, mention, bubble-menu, suggestion) |
| Canvas helpers | `perfect-freehand`, `rbush`, `fractional-indexing`, `nanoid` |
| Validation | `zod` |
| Unit/component tests | `vitest`, `jsdom`, `fake-indexeddb`, `@testing-library/svelte` |
| E2E | `@playwright/test`, `@axe-core/playwright` |
| PWA | `@vite-pwa/sveltekit` |
| Package manager | pnpm |
| Hosting | Any static host with SPA fallback (Cloudflare Pages / Netlify) |

## 3. Key decisions

| ID | Decision | Rationale |
|---|---|---|
| D1 | **Yjs `Y.Doc` is the source of truth for board content**, even without collaboration | Per-user undo (`Y.UndoManager`), incremental persistence (`y-indexeddb`), multi-tab sync, TipTap integration, and a future server sync without rewriting |
| D2 | **One `Y.Doc` per board**: `meta`, `elements`, `docs` maps | Atomic load; doc cards and canvas cross-reference safely |
| D3 | **Metadata (board list) is separate from board docs** — `idb` store `boards` | Start page must list boards without loading every Y.Doc |
| D4 | **Rendering:** one CSS-transformed "world" `<div>`; every element is one absolutely positioned wrapper (DOM order = z-order); SVG-type elements render an inner `<svg>`, HTML-type render HTML | Correct z-order between SVG and HTML elements; doc cards are real editors |
| D5 | **Selection handles, guides and previews render in a screen-space overlay** (not scaled) | Constant handle size at any zoom |
| D6 | **Hit-testing in TypeScript** (rbush + geometry); element wrappers `pointer-events: none` | Consistent for strokes/connectors/rotated shapes; unit-testable |
| D7 | **Every element type is connectable** via a `Connectable` implementation (default = rotated bounding box) | "Any object can be part of a diagram" is enforced by architecture |
| D8 | **Connector geometry is derived at render time**, never stored (except `lastX/lastY` on attachment and conversion to free) | Moving a shape never writes to connectors; no write storms |
| D9 | **Framework-agnostic core** (`model`, `storage`, `engine`, `diagram`, `render`) has no Svelte imports | Testable, portable |
| D10 | **Canvas undo ≠ editor undo.** Canvas `Y.UndoManager` scope = every page's element map + the `docs` map, tracking only `LOCAL` transactions; TipTap edits use the y-prosemirror origin, so they stay out of it and use the editor's own collaboration undo inside a focused editor | Avoids cross-talk between text and canvas undo; `docs` is in scope so undoing a card's creation/deletion (same LOCAL transaction) also removes/restores its text (step 23) |
| D11 | **Pages (sheets) are separate element maps in the same `Y.Doc`**: `meta.pages` lists them, the first page is the original `elements` map, others are `page:<id>`. The active page is per-tab view state (`getElementsMap(doc)` returns it), so the store, tools, undo and export work on one page at a time | Old boards and files stay valid with no data migration; switching pages swaps one map instead of filtering every element; two tabs can show different pages |
| D12 | **A sketch is one element with many strokes**, kept in an append-only `sketches` array outside the element and drawn on one `<canvas>` (the same path data is used for the live preview and SVG export) | "Real" sketching: hundreds of strokes don't become hundreds of objects, DOM nodes or undo-heavy element rewrites; the eraser can truly erase (`destination-out`) |

## 4. Folder structure

```
/
├─ CLAUDE.md  AGENTS.md  README.md
├─ plan/                          implementation plan (this)
├─ static/                        favicon, logo.svg, _redirects, _headers
├─ tests/e2e/                     Playwright specs + helpers.ts + fixtures/
├─ src/
│  ├─ app.html  app.css  app.d.ts
│  ├─ routes/
│  │  ├─ +layout.ts               ssr=false, prerender=false
│  │  ├─ +layout.svelte           css, theme, toaster
│  │  ├─ +page.svelte             start page
│  │  ├─ +error.svelte
│  │  └─ board/[id]/+page.svelte  board page
│  └─ lib/
│     ├─ model/                   types, schema (zod), defaults, ids, zorder, origins, doc, ops, clone, migrations
│     ├─ storage/                 db, boardsRepo, assetsRepo, channels, persist, boardDoc, tabSync, fileFormat
│     ├─ shared/                  localPrefs, theme.svelte.ts, debounce, base64, slug, relativeTime; ui/ (generic components)
│     ├─ home/                    start page components + boards.svelte.ts
│     ├─ templates/               board templates
│     ├─ dev/                     perf board generator, test hooks
│     └─ board/
│        ├─ BoardPage.svelte  TopBar.svelte  context.ts
│        ├─ boardStore.svelte.ts  viewport.svelte.ts  selection.svelte.ts
│        ├─ engine/               geometry, viewport math, spatialIndex, transform, snapping, align, simplify
│        ├─ canvas/               Canvas.svelte, ElementsLayer, OverlayLayer, SelectionOverlay, SnapGuides, ...
│        ├─ elements/             registry.ts, ElementView.svelte, <type>/definition.ts + <Type>View.svelte
│        ├─ tools/                types, toolManager.svelte.ts, pointerRouter, shortcuts, one file per tool
│        ├─ commands/             undo, clipboard, zorder, group, lock, delete, duplicate
│        ├─ diagram/              connectable, endpoints, connectorIndex, ops, routing/, markers, shapeLibrary, quickCreate
│        ├─ doccards/             editorFactory, DocCardView, FocusMode, mentions, slash, markdown
│        ├─ style/                StylePopover + controls, quickStyles, styleDefaults
│        ├─ images/               importImages, assetUrls
│        ├─ render/               staticSvg, wrapText, exportImage, thumbnails
│        └─ ui/                   Toolbar, ZoomControls, ContextMenu, ExportDialog, ShortcutsDialog, Onboarding
```

## 5. Data model (canonical types — `src/lib/model/types.ts`)

```ts
export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };

export type ElementType =
  | 'shape' | 'sticky' | 'text' | 'image' | 'stroke' | 'sketch' | 'frame' | 'doccard' | 'connector' | 'media';

export type ShapeKind =
  | 'rect' | 'ellipse' | 'diamond'                       // basic (toolbar)
  | 'process' | 'decision' | 'terminator' | 'data'       // flowchart library (step 22)
  | 'document' | 'database' | 'cloud' | 'actor';

export type StrokeWidth = 1 | 2 | 4 | 8;
export type FontSize = 's' | 'm' | 'l' | 'xl';           // 14 / 18 / 24 / 36 px at zoom 1

export interface Style {
  fill: string;                         // CSS color or 'transparent'
  fillStyle: 'none' | 'solid' | 'semi'; // semi = fill at 25% alpha
  stroke: string;
  strokeWidth: StrokeWidth;
  dash: 'solid' | 'dashed' | 'dotted';
  radius: 'none' | 'sm' | 'lg';         // 0 / 8 / 20 px
  shadow: boolean;
  opacity: number;                      // 0.1..1
  font: {
    size: FontSize;
    bold: boolean;
    italic: boolean;
    color: string;
    align: 'l' | 'c' | 'r';
    valign: 't' | 'm' | 'b';
    family?: string;                    // font id ($lib/fonts/catalog); missing/unknown = default
  };
}

export interface BaseElement {
  id: string;
  type: ElementType;
  x: number; y: number;                 // top-left of the unrotated box, world units
  w: number; h: number;
  rotation: number;                     // radians, around box center
  z: string;                            // fractional index; compare with plain < / >
  parentId: string | null;              // frame id
  groupId: string | null;               // flat groups: elements sharing a groupId
  locked: boolean;
  style: Style;
}

export interface ShapeElement   extends BaseElement { type: 'shape';   kind: ShapeKind; text: string }
export interface StickyElement  extends BaseElement { type: 'sticky';  text: string; color: string }
export interface TextElement    extends BaseElement { type: 'text';    text: string; autoWidth: boolean }
export interface ImageElement   extends BaseElement { type: 'image';   assetId: string; naturalW: number; naturalH: number }
export interface StrokeElement  extends BaseElement { type: 'stroke';  points: number[] } // flat [x,y,p,...] relative to (x,y), unscaled
export interface FrameElement   extends BaseElement { type: 'frame';   title: string }
export interface DocCardElement extends BaseElement { type: 'doccard'; title: string; collapsed: boolean; expandedH: number }

export type MediaProvider = 'youtube' | 'vimeo' | 'video' | 'audio';
export interface MediaElement extends BaseElement {   // schema version 5
  type: 'media';
  url: string;              // https only, as entered; shown and exported, never embedded directly
  provider: MediaProvider;  // parsed from the URL on creation (board/media/parseMediaUrl.ts)
  mediaId: string | null;   // YouTube/Vimeo id ([\w-]{1,64}); embeds are built from it; null for files
  start: number;            // seconds
  end: number | null;       // seconds; play up to here (a clip); null = to the end
  loop: boolean;
  title: string;            // poster label, ≤ 200 chars
}

export type Port = 'n' | 'e' | 's' | 'w';

export type Endpoint =
  | { kind: 'free';  x: number; y: number }
  | { kind: 'port';  elementId: string; port: Port;        lastX: number; lastY: number }
  | { kind: 'float'; elementId: string;                     lastX: number; lastY: number }
  | { kind: 'fixed'; elementId: string; u: number; v: number; lastX: number; lastY: number }; // u,v ∈ [0,1] local

export type Routing = 'straight' | 'elbow' | 'curve';
export type Marker = 'none' | 'arrow' | 'openArrow' | 'triangle' | 'diamond' | 'circle' | 'bar';

export interface ConnectorElement extends BaseElement {
  type: 'connector';                    // x,y,w,h,rotation unused (0) — geometry is derived (D8)
  from: Endpoint;
  to: Endpoint;
  routing: Routing;
  waypoints: Point[];                   // manual bends; [] = automatic
  markerStart: Marker;
  markerEnd: Marker;
  label: { text: string; t: number; background: boolean }; // t ∈ [0,1] along path length
}

export type Element =
  | ShapeElement | StickyElement | TextElement | ImageElement
  | StrokeElement | FrameElement | DocCardElement | ConnectorElement | MediaElement;
```

### Y.Doc layout

```
doc.getMap('meta')      schemaVersion: number, title: string, stylePresets: Style[] (JSON),
                        pages: { id: string; name: string }[] (JSON; absent = one page "Page 1" with id 'main')
doc.getMap('elements')  Y.Map<elementId, Y.Map<string, unknown>>   — the elements of page 'main'
doc.getMap('page:<id>') same shape, one map per additional page
                        - one nested Y.Map per element; each top-level field is one key
                        - object/array fields (style, from, to, label, waypoints, points) are stored
                          as plain JSON values and replaced as a whole on change
doc.getMap('docs')      Y.Map<doccardId, Y.XmlFragment>   (TipTap content)
doc.getMap('sketches')  Y.Map<sketchId, Y.Array<{ b: brush, c: color, s: size, p: number[] }>>
                        - append-only brush strokes of sketch elements; p = flat [x, y, pressure, …]
                          in the sketch's own coordinates
```

Rules:
- Element ids = map keys = `element.id` (`nanoid(12)`).
- `z` ordering: plain string comparison (`a < b`), **never** `localeCompare`.
- Frames render beneath all non-frame elements (own layer); `z` orders frames among themselves.
- Deleting a doccard deletes its `docs` entry in the same transaction.
- Deleting an element converts endpoints of connectors attached to it into `free` endpoints at their current resolved position, in the same transaction (step 20).
- `meta.schemaVersion` is set on first open; `migrate(doc)` runs on every open. Version 2 added pages (no data moves; the bump keeps older app versions from opening multi-page boards). Version 5 added media elements (no data moves; older versions would drop them from their view).
- Media (`src/lib/board/media`): which elements are playing is per-tab state (`PlaybackState` in the board context), never stored. A poster is shown until play; playing elements stay mounted when culled or when the scene canvas is shown; page switches stop playback. Double-click / Enter plays and hands the pointer to the player (the editing mode, like doc cards); Escape or a click elsewhere leaves it while playback continues. Exports, thumbnails and the scene canvas draw the poster. CSP: `frame-src https://www.youtube-nocookie.com https://player.vimeo.com; media-src 'self' blob: https:` — `connect-src` stays `'self'` (no oEmbed or thumbnail fetching).
- Fonts (`src/lib/fonts`): `catalog.ts` lists the fonts (id, label, category, CSS stack); 10 are bundled from `@fontsource*` packages (Latin, Latin Extended and Cyrillic woff2 subsets, ~1 MB in all, precached for offline use) and registered with the `FontFace` API under `SMTHNG <name>` families, so the browser downloads a subset only when text uses it. Canvas text stores the id in `style.font.family` (optional; no schema bump: an older app shows the default font); doc card text uses the `fontFamily` mark. Exports embed the files of the fonts they use as data URLs.
- Doc card text formatting (schema version 4): underline, `textColor`, `highlight`, `fontFamily` and `fontSize` marks and an `align` attribute on paragraphs and headings. The marks hold ids from fixed lists (`doccards/formatOptions.ts`), rendered as `data-*` attributes and styled in `prose.css`; text color and highlight also take a `#rrggbb` value (`data-*="custom"` plus a CSS variable in the style attribute). Anything else is dropped on parse. The bump matters: an older editor deletes text carrying marks it doesn't know.
- Sketches (schema version 3): `SketchElement { type: 'sketch'; bx; by; nw; nh }` shows the rectangle `(bx, by, nw, nh)` of its stroke space stretched onto its box. Adding a stroke appends to `sketches[id]` and grows that rectangle and the box together (one transaction, one undo step), so moving or resizing never rewrites stroke data. `sketches` entries are created, deleted, copied and undone with their element, like `docs`.
- Pages (`src/lib/model/pages.ts`): elements never move between maps; connectors attach only within a page; `docs` is shared and keyed by element id. Anything that must see the whole board (asset cleanup, import, board duplication) uses `allPageMaps` / `listAllElements`. Deleting a page removes its elements and their `docs` entries with origin `PAGES` (not undoable) and clears the undo history.

## 6. Storage

### IndexedDB database `smthng` (via `idb`), version 1

```ts
export interface BoardMeta {
  id: string;
  title: string;
  createdAt: number;       // epoch ms
  updatedAt: number;
  openedAt: number;
  starred: boolean;
  deletedAt: number | null; // non-null = in trash
  thumbnail: Blob | null;
  viewport: { x: number; y: number; zoom: number } | null;
}
export interface AssetRecord {
  id: string; boardId: string; blob: Blob; mime: string; width: number; height: number; createdAt: number;
}
```
- Store `boards` (keyPath `id`; indexes `openedAt`, `updatedAt`, `deletedAt`)
- Store `assets` (keyPath `id`; index `boardId`)

### Board contents
- One `y-indexeddb` database per board, name `smthng-board-<id>`.
- `openBoard(id)` (in `src/lib/storage/boardDoc.ts`) is the **only** place that wires providers to a Y.Doc. A future sync server is added here.

### Cross-tab sync
- `BroadcastChannel('smthng-meta')` — `{ type: 'boards-changed' }` after any metadata mutation.
- `BroadcastChannel('smthng-board-<id>')` — Yjs updates between tabs with the same board open (origin `REMOTE_TAB`).

### Transaction origins (`src/lib/model/origins.ts`)
`LOCAL` (user edits, tracked by undo) · `REMOTE_TAB` · `IMPORT` · `MIGRATION` · `TEMPLATE`. Each is a unique frozen object compared by identity.

### localStorage keys (via `localPrefs`)
`smthng:theme`, `smthng:home:sort`, `smthng:home:layout`, `smthng:defaults:<type>`, `smthng:copiedStyle`, `smthng:grid`, `smthng:snap`, `smthng:onboarded`, `smthng:lastBackupAt`, `smthng:backupReminderDismissedAt`, `smthng:testHooks`.

## 7. Yjs → Svelte bridge

`src/lib/board/boardStore.svelte.ts`:

```ts
export class BoardStore {
  readonly elements = new SvelteMap<string, Element>(); // immutable snapshots
  order = $state<string[]>([]);        // non-frame ids sorted by z; recomputed only on add/remove/z change
  frameOrder = $state<string[]>([]);   // frame ids sorted by z
  readonly index: SpatialIndex;        // non-reactive rbush wrapper, world AABBs
  readonly connectors: ConnectorIndex; // elementId -> connector ids (step 20)
  constructor(doc: Y.Doc) {}           // initial load + elements.observeDeep
  get(id: string): Element | undefined {}
  destroy(): void {}
}
```
- `observeDeep` handler collects changed element ids per transaction (`event.target === elementsMap` → `event.keysChanged`; nested events → `event.path[0]`), re-reads snapshots with `readElement()`, updates `elements`, `index`, and `order` if needed.
- Components receive plain `Element` snapshots and never touch Yjs.

## 8. Rendering & coordinates

- World units = CSS px at zoom 1. `screen = world * zoom + (vp.x, vp.y)` (screen relative to the canvas container).
- World layer: `transform: translate(vp.x px, vp.y px) scale(vp.zoom)`, `transform-origin: 0 0`.
- Element wrapper: `position:absolute; left:0; top:0; width:w; height:h; transform: translate(x,y) rotate(rotation rad); transform-origin: center`.
- Layers inside the canvas container, bottom → top: grid background → world(frames layer, elements layer) → overlay (screen space: selection, handles, guides, previews, quick-create buttons) → floating UI (style popover, context menu).
- Culling: render only ids whose AABB intersects the visible world rect expanded by 50%; selected/editing elements are always rendered.

## 9. Core interfaces

### Element registry (`src/lib/board/elements/registry.ts`)
```ts
export interface ElementDefinition<E extends Element = Element> {
  type: E['type'];
  component: Component<{ el: E; editing: boolean }>;
  aabb(el: E): Rect;                           // world-space axis-aligned bounds (rotation applied)
  hitTest(el: E, p: Point, tol: number): boolean; // tol in world units
  connectable: Connectable<E> | null;          // null only for connectors
  resizable: boolean;
  rotatable: boolean;
  keepAspect: boolean;                         // default aspect lock on resize (images)
  editableText: boolean;                       // double-click → text editing (media: double-click → play)
  styleOptions: StyleOption[];                 // which popover controls apply (step 17)
}
```

### Tools (`src/lib/board/tools/types.ts`)
```ts
export type ToolId = 'select' | 'hand' | 'pen' | 'eraser' | 'shape' | 'connector'
  | 'text' | 'sticky' | 'doccard' | 'frame' | 'image';

export interface CanvasPointerEvent {
  world: Point; screen: Point;
  button: number; pointerId: number; pointerType: string; pressure: number;
  shift: boolean; alt: boolean; mod: boolean;   // mod = ctrl || meta
  hit: { elementId?: string; handle?: HandleId };
  native: PointerEvent;
}

export interface Tool {
  id: ToolId;
  cursor: string;
  onPointerDown(e: CanvasPointerEvent): void;
  onPointerMove(e: CanvasPointerEvent): void;
  onPointerUp(e: CanvasPointerEvent): void;
  onDoubleClick?(e: CanvasPointerEvent): void;
  onKeyDown?(e: KeyboardEvent): boolean;        // true = handled
  onCancel(): void;                              // Escape / tool switch
}
```

### Connectable (`src/lib/board/diagram/connectable.ts`)
```ts
export interface Connectable<E extends Element = Element> {
  outline(el: E): Point[];                          // closed polygon, world coords
  ports(el: E): Record<Port, Point>;                // world coords
  portNormal(el: E, port: Port): Point;             // unit vector, outward
  rayExit(el: E, toward: Point): Point;             // where the ray center→toward exits the outline
  localToWorld(el: E, u: number, v: number): Point; // u,v ∈ [0,1] of the unrotated box
  worldToLocal(el: E, p: Point): { u: number; v: number };
}
export const boxConnectable: Connectable;           // default: rotated bounding box
```

### Board context (`src/lib/board/context.ts`)
Svelte context object created in `BoardPage.svelte`, grows over steps:
`{ id, doc, undo, store, viewport, selection, tools, commands, prefs }`. Access with `getBoard()`.

## 10. File format `.smthng` (step 27)

```ts
type SmthngFile =
  | { format: 'smthng'; version: 1; kind: 'board'; exportedAt: number; board: BoardPayload }
  | { format: 'smthng'; version: 1; kind: 'backup'; exportedAt: number; boards: BoardPayload[] };
type BoardPayload = {
  title: string; createdAt: number;
  doc: string;   // base64 of Y.encodeStateAsUpdate
  assets: { id: string; mime: string; width: number; height: number; data: string /* base64 */ }[];
};
```
Imports always create new board ids and new asset ids (remapped in the doc).

## 11. Keyboard shortcuts (`Mod` = Ctrl on Win/Linux, Cmd on macOS)

| Keys | Action | Keys | Action |
|---|---|---|---|
| V | Select | Mod+Z / Mod+Shift+Z / Mod+Y | Undo / Redo |
| H (hold Space) | Hand | Delete / Backspace | Delete |
| P | Pen | Mod+D | Duplicate |
| E | Eraser | Mod+C / X / V | Copy / Cut / Paste |
| R / O / D | Rectangle / Ellipse / Diamond | Mod+A | Select all |
| A | Connector | Mod+Shift+A | Select connected |
| T | Text | Mod+G / Mod+Shift+G | Group / Ungroup |
| S | Sticky | Mod+Shift+L | Lock / Unlock |
| N | Doc card | ] / [ | Forward / Backward |
| F | Frame | Mod+] / Mod+[ | To front / To back |
| Mod+Shift+I | Insert image | Mod+Alt+C / Mod+Alt+V | Copy / Paste style |
| Shift+1 | Zoom to fit | Shift+0 | Zoom to 100% |
| Shift+2 | Zoom to selection | Mod+= / Mod+- | Zoom in / out |
| Mod+' | Toggle grid snap | Mod+Enter | Open doc card in focus mode |
| Enter | Edit text / doc card | Escape | Cancel / deselect / exit edit |
| Arrows (+Shift) | Nudge 1px (10px) | ? | Shortcuts dialog |

Shortcuts are ignored while focus is in `input`, `textarea`, `select`, or `[contenteditable]` (except Escape handling defined per step).

## 12. Defaults

- Palette (12): `#1e1e1e`, `#868e96`, `#e03131`, `#f76707`, `#f59f00`, `#2f9e44`, `#0c8599`, `#1971c2`, `#6741d9`, `#c2255c`, `#ffffff`, `transparent`.
- Sticky colors (6): yellow `#ffe066`, orange `#ffc078`, pink `#faa2c1`, green `#b2f2bb`, blue `#a5d8ff`, violet `#d0bfff`. Sticky text is always dark (`#1e1e1e`).
- Default sizes: shape 160×100, sticky 200×200, text auto, doccard 360×280, frame 800×600, connector stub 20.
- Default connector: routing `elbow`, markerStart `none`, markerEnd `arrow`, stroke `#1e1e1e`, width 2.
- Font family (CSS + export): `Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` (exported as `FONT_FAMILY` from `model/defaults.ts`). Font sizes px: s 14, m 18, l 24, xl 36. Line height 1.35.
- Zoom range 0.1–4. Zoom steps: 0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4.
- Grid: 24px dots.

## 13. Performance targets

| Metric | Target |
|---|---|
| Pan/zoom | ≥ 55 fps with 3,000 mixed elements (Chrome, mid-range laptop) |
| Drag of 1 element among 3,000 | ≥ 55 fps |
| Board open (1,000 elements, cached) | < 1 s to interactive |
| Initial JS (gzipped) | home < 150 KB; board < 300 KB excluding lazy TipTap chunk |
