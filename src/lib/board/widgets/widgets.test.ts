import { describe, expect, it } from 'vitest';
import { createElements, getElement } from '$lib/model';
import { samples } from '$lib/model/testFixtures';
import type { WidgetElement } from '$lib/model/types';
import { testCtx } from '../testCtx';
import { createSelectTool } from '../tools/select.svelte';
import type { CanvasPointerEvent } from '../tools/types';

function setup() {
	const ctx = testCtx();
	createElements(ctx.doc, [{ ...samples.widget('w1'), x: 0, y: 0, w: 240, h: 240 }]);
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
		hit: { elementId: 'w1' },
		native: new MouseEvent('pointerdown'),
		...extra
	}) as CanvasPointerEvent;

const state = (ctx: ReturnType<typeof testCtx>) =>
	(getElement(ctx.doc, 'w1') as WidgetElement).state as { startedAt: number | null };

describe('widgets with the select tool', () => {
	it('a click on a button runs it without selecting; it is not an undo step', () => {
		const { ctx, tool } = setup();
		tool.onPointerDown(ev(140, 210));
		tool.onPointerUp(ev(140, 210));
		expect(state(ctx).startedAt).not.toBeNull();
		expect(ctx.selection.size).toBe(0);
		ctx.undo.undo(); // undoes the creation, not the start
		expect(getElement(ctx.doc, 'w1')).toBeNull();
	});

	it('a drag that starts on a button moves the widget instead', () => {
		const { ctx, tool } = setup();
		tool.onPointerDown(ev(140, 210));
		tool.onPointerMove(ev(200, 260));
		tool.onPointerUp(ev(200, 260));
		expect(state(ctx).startedAt).toBeNull();
		expect(ctx.selection.has('w1')).toBe(true);
	});

	it('Enter runs the main button; Shift+Enter opens the settings', () => {
		const { ctx, tool } = setup();
		ctx.selection.set(['w1']);
		tool.onKeyDown!(new KeyboardEvent('keydown', { key: 'Enter' }));
		expect(state(ctx).startedAt).not.toBeNull();
		tool.onKeyDown!(new KeyboardEvent('keydown', { key: 'Enter' }));
		expect(state(ctx).startedAt).toBeNull(); // paused
		tool.onKeyDown!(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true }));
		expect(ctx.widgets.settingsId).toBe('w1');
	});

	it('double-click opens the settings, but not on a button', () => {
		const { ctx, tool } = setup();
		tool.onDoubleClick!(ev(140, 210));
		expect(ctx.widgets.settingsId).toBeNull();
		tool.onDoubleClick!(ev(120, 80));
		expect(ctx.widgets.settingsId).toBe('w1');
	});

	it('hovering a button shows a pointer and highlights it', () => {
		const { ctx, tool } = setup();
		tool.onPointerMove(ev(140, 210, { dragging: false }));
		expect(ctx.widgets.hover).toEqual({ id: 'w1', action: 'toggle' });
		expect(tool.cursor).toBe('pointer');
		tool.onPointerMove(ev(120, 80, { dragging: false }));
		expect(ctx.widgets.hover).toBeNull();
	});

	it('a locked widget still runs, but its setup does not change', () => {
		const { ctx } = setup();
		ctx.selection.set([]);
		createElements(ctx.doc, [{ ...samples.widget('w2'), locked: true }]);
		expect(ctx.widgets.run('w2', 'plus')).toBe(false); // fresh: ±1 min edits the duration
		expect(ctx.widgets.run('w2', 'toggle')).toBe(true);
	});
});
