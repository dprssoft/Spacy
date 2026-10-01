# Step 17 — Style popover

Phase: D. Styling · Depends on: 16 · Estimate: 2 days

## Goal
A contextual floating style bar above the selection that shows only the options relevant to the selected element types, handles mixed values in multi-selection, and applies changes as one undo step.

## Read first
- `00-architecture.md` §5 (Style), §12 (palette, sticky colors)
- `src/lib/board/elements/registry.ts`, `common.ts`

## Tasks
1. **Style option model** `src/lib/board/style/options.ts`:
   ```ts
   export type StyleOption =
     | 'fill' | 'fillStyle' | 'stroke' | 'strokeWidth' | 'dash' | 'radius' | 'shadow' | 'opacity'
     | 'fontSize' | 'fontStyle' | 'textColor' | 'align' | 'valign'
     | 'shapeKind' | 'stickyColor'
     | 'routing' | 'markers' | 'labelBackground';   // connectors, used from step 21
   export const MIXED: unique symbol;
   export function optionsFor(types: ElementType[]): StyleOption[]   // intersection of each definition's styleOptions
   export function commonValue<T>(els: Element[], read: (el: Element) => T): T | typeof MIXED
   ```
   Set `styleOptions` in every definition:
   - shape: all except stickyColor and connector options
   - sticky: stickyColor, fontSize, fontStyle, align, valign, shadow, opacity
   - text: textColor, fontSize, fontStyle, align, opacity
   - image: stroke, strokeWidth, dash, radius, shadow, opacity
   - stroke: stroke, strokeWidth, opacity
   - frame: fill, fillStyle, stroke, radius
   - doccard (placeholder now; step 23 keeps these): fill, stroke, radius, shadow, fontSize
   - connector (placeholder; step 21): stroke, strokeWidth, dash, opacity, routing, markers, labelBackground
2. **Apply helper** `src/lib/board/style/applyStyle.ts`: `applyStyle(ctx, ids, patch: DeepPartial<Style> | { kind?: ShapeKind; color?: string })` → one `updateElements` in a single transaction (merge nested `font`). Call `undo.stopCapturing()` before each discrete change so separate clicks are separate undo steps; slider drags merge into one step through the capture timeout.
3. **Controls** `src/lib/board/style/controls/`:
   - `ColorSwatches.svelte`: the palette buttons (a checkerboard for `transparent`) and a "custom" button wrapping `<input type="color">`; the selected value gets a ring; MIXED shows no ring.
   - `Segmented.svelte`: a generic segmented control (`options: { value, label, icon? }[]`, `value | MIXED`, `onchange`), with `role="radiogroup"` and arrow-key support.
   - `ToggleButton.svelte` (bold, italic, shadow).
   - `Slider.svelte` (opacity 10–100%).
   - `ShapeKindPicker.svelte`: a dropdown with rect/ellipse/diamond icons (step 22 adds the library kinds).
   - `StickyColorPicker.svelte`: the 6 sticky colors.
4. **Popover** `src/lib/board/style/StylePopover.svelte`:
   - Visible when the selection is non-empty, not dragging or transforming, and not editing a doc card. It's hidden during pen/eraser use.
   - Position: screen-space, centered above the selection box with 12 px of spacing; flips below if there's under 56 px of room above; clamped to the canvas bounds. `data-interactive`.
   - Layout: a compact horizontal bar of primary controls (fill, stroke, stroke width, font size, text align, shape kind or sticky color — whichever apply), each opening a small bits-ui Popover panel with the full control. A "More" (•••) panel holds the secondary options: fillStyle, dash, radius, shadow, opacity, valign, bold/italic.
   - Controls show the `commonValue` across the selection.
5. **Rendering audit:** make sure every view honors every style field it declares (shape: fill/fillStyle/stroke/width/dash/radius/shadow/opacity/font; sticky: color/shadow/font; text: font color/size/style/align; image: border stroke/dash/radius/shadow; frame; stroke).
6. **Change shape kind** keeps the text, style, size and (later) connections — it's just `kind`.

## Files
- create: `src/lib/board/style/{options.ts, applyStyle.ts, StylePopover.svelte, controls/*}`
- modify: every `elements/*/definition.ts` and view as needed, `Canvas.svelte`

## Tests
- `options.test.ts`: `optionsFor(['shape','sticky'])` equals the intersection; `commonValue` returns the value or MIXED.
- `applyStyle.test.ts`: a nested font merge; a multi-element patch is one transaction.
- `tests/e2e/style.spec.ts`: select a rect → set the fill to red from the palette → the rect's path fill attribute is red → reload → still red. Select a rect and a sticky → the popover shows no fill control (not in the intersection) but shows font size. Two rects with different fills → the fill control shows the mixed state.

## Acceptance criteria
- [x] `pnpm verify` and `pnpm test:e2e` pass
- [x] The popover never covers the selected element when there's room above or below
- [x] All controls are keyboard-operable with visible focus

## Out of scope
Quick styles, copy/paste style, defaults, align/distribute (step 18); connector options (step 21).

## Commit
`feat(style): add contextual style popover with per-type options and mixed values`
