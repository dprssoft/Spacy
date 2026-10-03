# SMTHNG — Implementation plan

A browser-only whiteboard (with diagram and doc-card add-ons) and a Figma-like start page. SvelteKit + Svelte 5 + TypeScript + Tailwind v4. No backend.

**Agents:** follow the protocol in [`CLAUDE.md`](../CLAUDE.md). Read [`00-architecture.md`](./00-architecture.md) before every step. Do the first unchecked step whose dependencies are done, one step per run, and log it in [`PROGRESS.md`](./PROGRESS.md).

## Milestones

| Milestone | After step | What a human can check |
|---|---|---|
| M1: Start page | 08 | Create, rename, star, duplicate, trash and restore boards; open a board with an editable title |
| M2: Whiteboard | 16 | Draw, add shapes, stickies, text, images and frames; select, transform, undo, copy/paste |
| M3: Styling | 18 | Style everything, quick styles, align, snapping |
| M4: Diagrams | 22 | Connect any object to any object; routing, markers, labels, bends, shape library, quick-create |
| M5: Doc cards | 25 | Rich text on the canvas, focus mode, mentions, Markdown export |
| M6: Sharing | 28 | PNG/SVG export, thumbnails, `.smthng` import/export, backup, templates |
| M7: v1.0 | 32 | PWA, performance, accessibility, full E2E, deploy |
| M8: Extensions | 36 | Insert templates (kanban, retro, SWOT…) into any board; play YouTube, Vimeo, audio and video on the board with rich controls |
| M9: Mobile | 38 | Use and edit boards on phones and tablets: fitted layout, finger gestures, long-press menu, style sheet, keyboard-aware editing |
| M10: Writers | 46 | Word counts, focus aids, writing templates, outline + compile to one manuscript, backlinks, find & replace, comments on anything, waystones |

## Steps

| ✓ | # | Step | Phase | Depends on | Est. |
|---|---|---|---|---|---|
| [x] | 01 | [Scaffold the project](./steps/01-scaffold.md) | A. Foundation | — | 0.5d |
| [x] | 02 | [App shell, routing, theme](./steps/02-app-shell-routing-theme.md) | A | 01 | 0.5d |
| [x] | 03 | [Domain model](./steps/03-domain-model.md) | A | 01 | 1.5d |
| [x] | 04 | [Metadata and asset storage](./steps/04-metadata-storage.md) | A | 03 | 1.5d |
| [x] | 05 | [Board document lifecycle](./steps/05-board-document-lifecycle.md) | B. Start page | 04 | 1d |
| [x] | 06 | [Start page layout](./steps/06-start-page-layout.md) | B | 02, 05 | 1d |
| [x] | 07 | [Board management actions](./steps/07-board-management-actions.md) | B | 06 | 1.5d |
| [x] | 08 | [Board page and top bar](./steps/08-board-page-top-bar.md) | B | 07 | 0.5d |
| [x] | 09 | [Viewport: pan and zoom](./steps/09-viewport.md) | C. Canvas | 08 | 1.5d |
| [x] | 10 | [Element registry, store, rendering](./steps/10-element-registry-rendering.md) | C | 09 | 2d |
| [x] | 11 | [Tool framework and toolbar](./steps/11-tool-framework-toolbar.md) | C | 10 | 1d |
| [x] | 12 | [Creation tools and text editing](./steps/12-creation-tools-text-editing.md) | C | 11 | 1.5d |
| [x] | 13 | [Selection and transforms](./steps/13-selection-transforms.md) | C | 12 | 2d |
| [x] | 14 | [Editing commands](./steps/14-editing-commands.md) | C | 13 | 1.5d |
| [x] | 15 | [Pen, eraser, images](./steps/15-pen-eraser-images.md) | C | 14 | 1.5d |
| [x] | 16 | [Frames](./steps/16-frames.md) | C | 15 | 1d |
| [x] | 17 | [Style popover](./steps/17-style-popover.md) | D. Styling | 16 | 2d |
| [x] | 18 | [Style productivity and snapping](./steps/18-style-productivity-snapping.md) | D | 17 | 2d |
| [x] | 19 | [Connectable interface](./steps/19-connectable.md) | E. Diagrams | 18 | 1.5d |
| [x] | 20 | [Connector tool and endpoints](./steps/20-connector-tool-endpoints.md) | E | 19 | 2d |
| [x] | 21 | [Routing, markers, labels](./steps/21-routing-markers-labels.md) | E | 20 | 2d |
| [x] | 22 | [Bends, shape library, quick-create](./steps/22-bends-library-quick-create.md) | E | 21 | 2.5d |
| [x] | 23 | [Doc card element](./steps/23-doc-card-element.md) | F. Doc cards | 20 | 2d |
| [x] | 24 | [Focus mode and mentions](./steps/24-focus-mode-mentions.md) | F | 23 | 2d |
| [x] | 25 | [Markdown export](./steps/25-markdown-export.md) | F | 24 | 1d |
| [x] | 26 | [Static SVG renderer, export, thumbnails](./steps/26-static-svg-export-thumbnails.md) | G. Sharing | 22, 25 | 2d |
| [x] | 27 | [`.smthng` files, import, backup](./steps/27-file-format-import-export.md) | G | 26 | 1.5d |
| [x] | 28 | [Templates](./steps/28-templates.md) | G | 27 | 1.5d |
| [x] | 29 | [PWA, settings, backup reminder](./steps/29-pwa.md) | H. Release | 28 | 1d |
| [x] | 30 | [Performance pass](./steps/30-performance.md) | H | 29 | 1d |
| [x] | 31 | [Accessibility, help, onboarding](./steps/31-accessibility-help-onboarding.md) | H | 30 | 1.5d |
| [ ] | 32 | [Full E2E and deployment](./steps/32-e2e-deploy.md) | H | 31 | 1.5d |
| [x] | 33 | [Insertable templates](./steps/33-insertable-templates.md) | I. Extensions | 28 | 1d |
| [x] | 34 | [Template pack (kanban and friends)](./steps/34-template-pack.md) | I | 33 | 2d |
| [x] | 35 | [Media element](./steps/35-media-element.md) | I | 31 | 2.5d |
| [x] | 36 | [Rich media controls](./steps/36-rich-media-controls.md) | I | 35 | 2.5d |
| [x] | 37 | [Mobile layout and touch navigation](./steps/37-mobile-layout-touch-navigation.md) | J. Mobile | 36 | 1.5d |
| [x] | 38 | [Touch editing](./steps/38-mobile-touch-editing.md) | J | 37 | 1.5d |
| [ ] | 39 | [Word count and focus mode options](./steps/39-word-count-focus-options.md) | K. Writers | 38 | 1d |
| [ ] | 40 | [Writer templates](./steps/40-writer-templates.md) | K | 34 | 1d |
| [ ] | 41 | [Outline panel](./steps/41-outline-panel.md) ⚠ approval (meta.outline) | K | 39 | 1.5d |
| [ ] | 42 | [Manuscript compile](./steps/42-manuscript-compile.md) | K | 41 | 2d |
| [ ] | 43 | [Backlinks](./steps/43-backlinks.md) | K | 39 | 1d |
| [ ] | 44 | [Find and replace](./steps/44-find-replace.md) | K | 39 | 1.5d |
| [ ] | 45 | [Comments](./steps/45-comments.md) ⚠ approval (non-goal, data model, schema 6) | K | 44 | 2.5d |
| [ ] | 46 | [Waystones](./steps/46-waystones.md) ⚠ approval (element type, schema) | K | 43 | 1.5d |

Total is about 46 working days for one developer, or about 11–12 weeks with a buffer.

## Step file format

Each step file contains these sections:
- **Goal:** the outcome in one or two sentences
- **Read first:** architecture sections and files to load into context
- **Tasks:** numbered, concrete instructions
- **Files:** what to create or modify
- **Tests:** what to write
- **Acceptance criteria:** checkboxes to tick when verified
- **Out of scope:** what not to build yet
- **Commit:** the commit message
