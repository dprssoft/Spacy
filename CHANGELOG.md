# Changelog

## 1.0.0 — 2026-10-04

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

### Sketching

- Sketch tool (B): strokes go into one sketch object instead of one object per stroke.
- Brushes: pen and pencil (stylus pressure changes the width), marker, highlighter, and an eraser that erases inside the sketch. Size and color in the ribbon.
- Sketches move, resize, copy, export (vector) and undo stroke by stroke.

### Doc card formatting

- While a doc card is edited, the ribbon shows Word-like formatting: style (normal text, headings, quote, code), font, size, bold, italic, underline, strikethrough, text color, highlight, clear formatting, lists and alignment. Focus mode has the same toolbar.
- Large doc cards drag at full speed (a card with a million characters went from 10 to 60 frames per second).
- Ctrl/⌘+Enter in a doc card opens focus mode without adding a line break to the text.

### Fonts and colors

- 13 fonts for all text — shapes, sticky notes, text, doc cards (whole card or selected text): Inter, Montserrat, Oswald, Comfortaa, Lora, Roboto Slab, Playfair Display, JetBrains Mono, Caveat and Pacifico are bundled (Latin and Cyrillic, about 1 MB, work offline), plus the default, a system serif and a system monospace. Exports embed the fonts they use.
- A 50-color palette (four shades of ten hues and a row of grays) in every color picker: fill, stroke, text, sticky notes, sketch brushes ("More colors"), doc card text and highlight.
- Any color: a color picker and a hex field everywhere, and the last custom colors under "Recent". Sticky notes take any color too.

### Media

- Paste a YouTube, Vimeo, audio or video link to get a media object that plays in place.
- One set of controls for every player: play and pause, seek, volume, speed, clips with start and end, loop, full screen and keyboard shortcuts.

### Templates

- A template gallery: Flowchart, Brainstorm, Meeting notes, Kanban, Retrospective, SWOT, Eisenhower matrix, Mind map, Timeline, Journey map, Business model canvas and Weekly planner, plus writing templates (story structures, characters, world-building, scene cards, article, screenplay).
- Start a board from a template, or insert one into the current board.

### Writing

- Word count and reading time; optional focus mode aids.
- Outline panel: the manuscript order of doc cards, with word counts and drag to reorder.
- Compile doc cards into one manuscript: Markdown, Word or print/PDF.
- Backlinks: see where each object is mentioned.
- Find and replace across all text on the board.
- Drop text, Markdown and Word files on the board to make doc cards.

### Comments

- Comment threads on any object and on text inside doc cards: reply, resolve, reopen; a panel lists them per page.

### Navigation and presenting

- Waystones: named checkpoints on a page to fly between, with a list, keys and a full-screen presenting mode.
- Go to the nearest object (Shift+N), back to origin, full screen mode (Shift+F).

### Phones and tablets

- The start page and boards fit phones: one-finger pan, pinch zoom, long-press menus and marquee, double-tap, a style sheet and keyboard-aware editing, palm rejection for the stylus.

### Pages and settings

- Duplicate a page; pick several tabs (Ctrl/⌘- or Shift-click) to duplicate or delete them together.
- Six UI palettes in Settings, each with light and dark variants.

### Reliability

- A save that doesn't reach browser storage (for example when it's full) shows "Not saved" with a Retry, and leaving the page asks first.
- Deleting a page also deletes the comments on it.

### M7 — Release quality

- Installable and fully offline (PWA) with an update prompt; settings and a backup reminder.
- Lazy-loaded editor and export code; low-zoom doc card previews.
- Keyboard-only flows, screen reader announcements, shortcuts dialog, first-run tips, reduced motion.
- Content-Security-Policy and security headers; end-to-end tests in Chromium, Firefox and WebKit.
- A lighter start page: template previews and storage housekeeping load after it has painted.
