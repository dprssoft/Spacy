import { describe, expect, it } from 'vitest';
import { getSketchesMap } from '$lib/model/doc';
import { updateElement } from '$lib/model/ops';
import type { SketchElement } from '$lib/model/types';
import { duplicateSelection, deleteSelection } from '../commands/edit';
import { renderStaticSvg } from '../render/staticSvg';
import { testCtx } from '../testCtx';
import { readStrokes } from './data';
import { getDefinition } from '../elements/registry';
import '../elements';
import { applyStyle } from '../style/applyStyle';
import { SHEET_MARGIN, sketchHit } from './geometry';
import { commitStroke } from './ops';

const pen = { id: 'pen' as const, size: 6, color: '#1e1e1e' };
const line = (x1: number, y1: number, x2: number, y2: number) => [
	x1,
	y1,
	0.5,
	(x1 + x2) / 2,
	(y1 + y2) / 2 + 3,
	0.5,
	x2,
	y2,
	0.5
];
const sketches = (ctx: ReturnType<typeof testCtx>) =>
	[...ctx.store.elements.values()].filter((e): e is SketchElement => e.type === 'sketch');

describe('commitStroke', () => {
	it('many strokes become one object, each stroke one undo step', () => {
		const ctx = testCtx();
		const id = commitStroke(ctx, null, pen, line(0, 0, 100, 0))!;
		expect(commitStroke(ctx, id, pen, line(0, 50, 100, 50))).toBe(id);
		expect(commitStroke(ctx, id, { ...pen, id: 'marker' }, line(0, 100, 100, 100))).toBe(id);
		expect(sketches(ctx)).toHaveLength(1);
		expect(readStrokes(ctx.doc, id).map((s) => s.b)).toEqual(['pen', 'pen', 'marker']);
		expect(ctx.store.elements.size).toBe(1);

		ctx.undo.undo();
		expect(readStrokes(ctx.doc, id)).toHaveLength(2);
		ctx.undo.undo();
		ctx.undo.undo(); // the first stroke created the object
		expect(sketches(ctx)).toHaveLength(0);
		expect(getSketchesMap(ctx.doc).has(id)).toBe(false);
		ctx.undo.redo();
		expect(readStrokes(ctx.doc, id)).toHaveLength(1);
	});

	it('the frame grows with the drawing and earlier strokes stay put', () => {
		const ctx = testCtx();
		const id = commitStroke(ctx, null, { ...pen, id: 'marker', size: 10 }, line(0, 0, 100, 0))!;
		const first = sketches(ctx)[0]!;
		const m = SHEET_MARGIN;
		expect(first).toMatchObject({ x: -5 - m, y: -5 - m, w: 110 + 2 * m });
		commitStroke(ctx, id, { ...pen, id: 'marker', size: 10 }, line(-200, 300, -100, 300));
		const grown = sketches(ctx)[0]!;
		expect(grown.x).toBe(-205 - m);
		expect(grown.y).toBe(-5 - m);
		expect(grown.w).toBe(310 + 2 * m);
		expect(grown.h).toBeGreaterThan(300);
		// The first stroke is stored unchanged.
		expect(readStrokes(ctx.doc, id)[0]!.p.slice(0, 2)).toEqual([0, 0]);
	});

	it('draws correctly into a moved and resized sketch, keeping the brush width on the board', () => {
		const ctx = testCtx();
		const marker = { id: 'marker' as const, size: 10, color: '#e03131' };
		const id = commitStroke(ctx, null, marker, line(0, 0, 100, 0))!;
		const el = sketches(ctx)[0]!;
		// Twice as large, somewhere else.
		updateElement(ctx.doc, id, { x: 1000, y: 1000, w: el.w * 2, h: el.h * 2 });
		commitStroke(ctx, id, marker, line(1010, 1010, 1110, 1010));
		const added = readStrokes(ctx.doc, id)[1]!;
		expect(added.s).toBe(5); // half the size in sketch units = the same 10 on the board
		expect(added.p[0]).toBe(5 + el.bx); // (1010 - 1000) / 2 + bx
	});

	it('an eraser only works inside an existing sketch and never grows it', () => {
		const ctx = testCtx();
		const eraser = { id: 'eraser' as const, size: 10, color: '#000000' };
		expect(commitStroke(ctx, null, eraser, line(0, 0, 100, 0))).toBeNull();
		expect(ctx.store.elements.size).toBe(0);
		const id = commitStroke(ctx, null, pen, line(0, 0, 100, 0))!;
		const before = sketches(ctx)[0]!;
		commitStroke(ctx, id, eraser, line(-500, -500, 500, 500));
		expect(sketches(ctx)[0]).toMatchObject({ x: before.x, y: before.y, w: before.w, h: before.h });
		expect(readStrokes(ctx.doc, id).at(-1)?.b).toBe('eraser');
	});

	it('is hit on its strokes, not on its whole box', () => {
		const ctx = testCtx();
		const id = commitStroke(ctx, null, pen, line(0, 0, 200, 0))!;
		commitStroke(ctx, id, pen, line(0, 200, 200, 200));
		const el = sketches(ctx)[0]!;
		// The registry uses this same function, with the strokes the store provides.
		const hit = (x: number, y: number) =>
			sketchHit(el, ctx.store.world.strokes!(el.id), { x, y }, 2);
		expect(hit(100, 1)).toBe(true);
		expect(hit(100, 100)).toBe(false); // empty middle of the box
	});

	it('a colored sheet is hit on its whole box, and transparent again on its strokes only', () => {
		const ctx = testCtx();
		const id = commitStroke(ctx, null, pen, line(0, 0, 200, 0))!;
		commitStroke(ctx, id, pen, line(0, 200, 200, 200));
		const hit = () =>
			getDefinition('sketch').hitTest(sketches(ctx)[0]!, { x: 100, y: 100 }, 2, ctx.store.world);
		expect(hit()).toBe(false);
		applyStyle(ctx, [id], { style: { fill: '#ffec99' } });
		expect(sketches(ctx)[0]!.style).toMatchObject({ fill: '#ffec99', fillStyle: 'solid' });
		expect(hit()).toBe(true);
		applyStyle(ctx, [id], { style: { fill: 'transparent' } });
		expect(hit()).toBe(false);
	});

	it('exports the sheet under the strokes, outside the masks of erasers', async () => {
		const ctx = testCtx();
		const id = commitStroke(ctx, null, pen, line(0, 0, 200, 0))!;
		commitStroke(ctx, id, { ...pen, id: 'eraser' }, line(50, -10, 50, 10));
		const svg = async () => {
			const el = sketches(ctx)[0]!;
			const out = await renderStaticSvg({
				elements: [el],
				lookup: (i) => ctx.store.get(i),
				background: '#ffffff',
				measure: () => 0,
				assetDataUrl: async () => null,
				docLines: async () => [],
				sketchStrokes: (i) => ctx.store.world.strokes!(i)
			});
			return out.svg;
		};
		expect(await svg()).not.toContain('#ffec99');
		applyStyle(ctx, [id], { style: { fill: '#ffec99' } });
		expect(await svg()).toMatch(
			/<rect width="[\d.]+" height="[\d.]+" fill="#ffec99"[^>]*\/><g transform/
		);
	});

	it('duplicate copies the strokes; delete and undo remove and restore them', async () => {
		const ctx = testCtx();
		const id = commitStroke(ctx, null, pen, line(0, 0, 100, 0))!;
		commitStroke(ctx, id, pen, line(0, 40, 100, 40));
		ctx.undo.stopCapturing();
		ctx.selection.set([id]);
		duplicateSelection(ctx);
		const copy = sketches(ctx).find((s) => s.id !== id)!;
		expect(readStrokes(ctx.doc, copy.id)).toHaveLength(2);
		expect(readStrokes(ctx.doc, copy.id)).toEqual(readStrokes(ctx.doc, id));

		ctx.undo.stopCapturing();
		ctx.selection.set([id]);
		deleteSelection(ctx);
		expect(getSketchesMap(ctx.doc).has(id)).toBe(false);
		ctx.undo.undo();
		expect(readStrokes(ctx.doc, id)).toHaveLength(2);
	});

	it('exports as SVG paths, with erasers as masks', async () => {
		const ctx = testCtx();
		const id = commitStroke(ctx, null, pen, line(0, 0, 100, 0))!;
		commitStroke(ctx, id, { id: 'highlighter', size: 8, color: '#f59f00' }, line(0, 20, 100, 20));
		commitStroke(ctx, id, { id: 'eraser', size: 8, color: '#000' }, line(50, -10, 50, 30));
		const el = sketches(ctx)[0]!;
		const { svg } = await renderStaticSvg({
			elements: [el],
			lookup: (i) => ctx.store.get(i),
			background: '#ffffff',
			measure: () => 0,
			assetDataUrl: async () => null,
			docLines: async () => [],
			sketchStrokes: (i) => readStrokes(ctx.doc, i)
		});
		const dom = new DOMParser().parseFromString(svg, 'image/svg+xml');
		expect(dom.getElementsByTagName('parsererror')).toHaveLength(0);
		expect(dom.querySelectorAll('mask')).toHaveLength(1);
		expect(svg).toContain('opacity="0.35"');
		expect(svg).toContain('mask="url(#erase');
	});
});
