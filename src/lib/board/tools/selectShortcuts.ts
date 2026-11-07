import { copyImage } from '../render/exportImage';
import { updateElements } from '$lib/model/ops';
import { unionRects } from '../engine/geometry';
import { fitRect } from '../engine/viewport';
import { syncFrameMembership, withFrameChildren } from '../frameMembership';
import { transformTargets } from '../selectionInfo';
import type { Shortcut } from './shortcuts';

const nudge = (id: string, keys: string[], dx: number, dy: number): Shortcut => ({
	id: `select.nudge.${id}`,
	keys,
	label: `Nudge ${id}`,
	group: 'Arrange',
	when: (ctx) => ctx.tools.current === 'select' && ctx.selection.size > 0,
	run: (ctx) => {
		const targets = withFrameChildren(ctx, transformTargets(ctx));
		const before = new Map(
			targets.filter((el) => el.type === 'frame').map((f) => [f.id, { ...f }])
		);
		// Consecutive nudges merge into one undo step through the undo manager's capture window.
		updateElements(
			ctx.doc,
			targets.map((el) => ({ id: el.id, patch: { x: el.x + dx, y: el.y + dy } }))
		);
		syncFrameMembership(
			ctx,
			targets.map((el) => el.id),
			before
		);
	}
});

export const selectShortcuts: Shortcut[] = [
	nudge('left', ['ArrowLeft'], -1, 0),
	nudge('right', ['ArrowRight'], 1, 0),
	nudge('up', ['ArrowUp'], 0, -1),
	nudge('down', ['ArrowDown'], 0, 1),
	nudge('left10', ['Shift+ArrowLeft'], -10, 0),
	nudge('right10', ['Shift+ArrowRight'], 10, 0),
	nudge('up10', ['Shift+ArrowUp'], 0, -10),
	nudge('down10', ['Shift+ArrowDown'], 0, 10),
	{
		id: 'edit.copyImage',
		keys: ['Mod+Shift+C'],
		label: 'Copy as image',
		group: 'Edit',
		when: (ctx) => ctx.selection.size > 0,
		run: (ctx) => void copyImage(ctx, { kind: 'selection' }, 2, '#ffffff')
	},
	{
		id: 'select.all',
		keys: ['Mod+A'],
		label: 'Select all',
		group: 'Edit',
		run: (ctx) => {
			ctx.tools.setTool('select');
			ctx.selection.enteredGroup = null;
			ctx.selection.set(
				[...ctx.store.elements.values()].filter((el) => !el.locked).map((el) => el.id)
			);
		}
	},
	{
		id: 'view.selection',
		keys: ['Shift+2'],
		label: 'Zoom to selection',
		group: 'View',
		when: (ctx) => ctx.selection.size > 0,
		run: (ctx) => {
			const rects = [...ctx.selection.ids].flatMap((id) => ctx.store.index.get(id) ?? []);
			const bounds = unionRects(rects);
			if (bounds) ctx.viewport.animateTo(fitRect(bounds, ctx.viewport.size, 80, 2));
		}
	}
];
