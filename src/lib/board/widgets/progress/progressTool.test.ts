import { describe, expect, it } from 'vitest';
import { createElements, getElement } from '$lib/model';
import { samples } from '$lib/model/testFixtures';
import type { WidgetElement } from '$lib/model/types';
import { testCtx } from '../../testCtx';
import { createSelectTool } from '../../tools/select.svelte';
import type { CanvasPointerEvent } from '../../tools/types';
import { DEFAULT_PROGRESS, type ProgressConfig } from './progress';
import '../index';

function setup() {
	const ctx = testCtx();
	createElements(ctx.doc, [
		{
			...samples.widget('p'),
			kind: 'progress',
			config: DEFAULT_PROGRESS,
			state: null,
			x: 0,
			y: 0,
			w: 260,
			h: 110
		},
		{ ...samples.doccard('card'), x: 1000, y: 0, w: 400, h: 300 }
	]);
	ctx.undo.stopCapturing();
	return { ctx, tool: createSelectTool(ctx) };
}

const ev = (x: number, y: number, extra: Partial<CanvasPointerEvent> = {}): CanvasPointerEvent =>
	({
		world: { x, y },
		screen: { x: x + 500, y: y + 400 },
		button: 0,
		dragging: true,
		pointerId: 1,
		pointerType: 'mouse',
		pressure: 0.5,
		shift: false,
		alt: false,
		mod: false,
		hit: { elementId: 'p' },
		native: new MouseEvent('pointerdown'),
		...extra
	}) as CanvasPointerEvent;

const config = (ctx: ReturnType<typeof testCtx>) =>
	(getElement(ctx.doc, 'p') as WidgetElement).config as ProgressConfig;

describe('progress with the select tool', () => {
	it('a drag along the bar sets the value as one undo step', () => {
		const { ctx, tool } = setup();
		tool.onPointerDown(ev(16 + 228 * 0.2, 60));
		tool.onPointerMove(ev(16 + 228 * 0.5, 60));
		tool.onPointerMove(ev(16 + 228 * 0.71, 62, { shift: true }));
		tool.onPointerUp(ev(16 + 228 * 0.71, 62, { shift: true }));
		expect(config(ctx).value).toBe(71);
		// It didn't move.
		expect(getElement(ctx.doc, 'p')).toMatchObject({ x: 0, y: 0 });
		ctx.undo.undo();
		expect(config(ctx).value).toBe(0);
	});

	it('dropped on a doc card, it counts that card’s checklist', () => {
		const { ctx, tool } = setup();
		ctx.selection.set(['p']);
		tool.onPointerDown(ev(130, 20));
		tool.onPointerMove(ev(1200, 100));
		tool.onPointerUp(ev(1200, 100));
		expect(config(ctx)).toMatchObject({ source: 'checklist', cardId: 'card' });
		// Moving and linking are one undo step.
		ctx.undo.undo();
		expect(config(ctx)).toEqual(DEFAULT_PROGRESS);
		expect(getElement(ctx.doc, 'p')).toMatchObject({ x: 0, y: 0 });
	});
});
