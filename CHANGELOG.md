# Changelog

## 1.0.0 — 2026-10-03

The first release: a whiteboard that lives in your browser, with diagrams and doc cards.

### M1 — Foundation

- SvelteKit single-page app, light and dark themes.
- Start page with recent, starred, all and trashed boards; search, sort, grid and list layouts.
- Boards stored locally (IndexedDB) and kept in sync between tabs.

### M2 — Whiteboard

- Infinite canvas with pan, zoom, grid and zoom-to-fit.
- Shapes, sticky notes, text, freehand pen with eraser, images and frames.
- Select, move, resize, rotate, group, lock, reorder; undo and redo; copy, paste and duplicate.

### M3 — Styling

- Contextual style popover: fill, stroke, dash, corner radius, opacity, shadow, text options.
- Quick styles, copy and paste style, defaults per element type.
- Align, distribute, smart guides and snap to grid.

### M4 — Diagrams

- Connect any object to any object: ports, floating and fixed anchors.
- Straight, elbow and curved routing; seven end markers; labels along the line; manual bends.
- Flowchart shape library, quick-create of connected shapes, select connected.

### M5 — Doc cards

- Rich-text documents on the canvas: headings, lists, checklists, quotes, code, links.
- Full-page focus mode with a shareable `?doc=` link, formatting menu, `/` commands.
- `@` mentions of canvas objects that jump to them; Markdown export.

### M6 — Sharing

- PNG and SVG export of the board, a selection or a frame; start-page thumbnails.
- `.smthng` files: export, import, full backup; "Save to file" in Chromium.
- Flowchart, Brainstorm and Meeting notes templates.

### Pages and layout

- Several pages per board, as sheet tabs in the status bar: add, rename (double-click), reorder and delete; undo returns to the page it happened on.
- Office-style layout: a ribbon toolbar with Select, Draw, Insert and Options groups, and a status bar with pages, an object count and zoom.
- Drag a "+" button onto any object to connect to it.

### M7 — Release quality

- Installable and fully offline (PWA) with an update prompt; settings and a backup reminder.
- Lazy-loaded editor and export code; low-zoom doc card previews.
- Keyboard-only flows, screen reader announcements, shortcuts dialog, first-run tips, reduced motion.
- Content-Security-Policy and security headers; end-to-end tests in Chromium, Firefox and WebKit.
