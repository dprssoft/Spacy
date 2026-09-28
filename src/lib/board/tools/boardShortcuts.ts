import type { ShapeKind } from '$lib/model/types';
import type { BoardContext } from '../context';
import { nextZoomStep, zoomAt } from '../engine/viewport';
import type { Shortcut } from './shortcuts';
import type { ToolId } from './types';

const tool = (
	id: string,
	keys: string,
	label: string,
	toolId: ToolId,
	kind?: ShapeKind
): Shortcut => ({
	id: `tool.${id}`,
	keys: [keys],
	label,
	group: 'Tools',
	when: (ctx) => ctx.tools.isAvailable(toolId),
	run: (ctx) => {
		if (kind) ctx.tools.shapeKind = kind;
		ctx.tools.setTool(toolId);
	}
});

const zoomStep = (ctx: BoardContext, dir: 1 | -1) =>
	ctx.viewport.animateTo(
		zoomAt(ctx.viewport.vp, ctx.viewport.center, nextZoomStep(ctx.viewport.zoom, dir))
	);

export const toolShortcuts: Shortcut[] = [
	tool('select', 'V', 'Select', 'select'),
	tool('hand', 'H', 'Hand', 'hand'),
	tool('pen', 'P', 'Pen', 'pen'),
	tool('eraser', 'E', 'Eraser', 'eraser'),
	tool('rect', 'R', 'Rectangle', 'shape', 'rect'),
	tool('ellipse', 'O', 'Ellipse', 'shape', 'ellipse'),
	tool('diamond', 'D', 'Diamond', 'shape', 'diamond'),
	tool('connector', 'A', 'Connector', 'connector'),
	tool('text', 'T', 'Text', 'text'),
	tool('sticky', 'S', 'Sticky note', 'sticky'),
	tool('doccard', 'N', 'Doc card', 'doccard'),
	tool('frame', 'F', 'Frame', 'frame'),
	tool('image', 'Mod+Shift+I', 'Insert image', 'image'),
	{
		id: 'escape',
		keys: ['Escape'],
		label: 'Cancel / deselect',
		group: 'Tools',
		run: (ctx) => {
			ctx.tools.tool.onCancel();
			if (ctx.selection.size > 0) ctx.selection.clear();
			else ctx.tools.setTool('select');
		}
	}
];

export const viewShortcuts: Shortcut[] = [
	{
		id: 'view.fit',
		keys: ['Shift+1'],
		label: 'Zoom to fit',
		group: 'View',
		run: (ctx) => ctx.viewport.fit(ctx.store.contentBounds())
	},
	{
		id: 'view.100',
		keys: ['Shift+0', 'Mod+0'],
		label: 'Zoom to 100%',
		group: 'View',
		run: (ctx) => ctx.viewport.reset100()
	},
	{
		id: 'view.zoomIn',
		keys: ['Mod+=', 'Mod++'],
		label: 'Zoom in',
		group: 'View',
		run: (ctx) => zoomStep(ctx, 1)
	},
	{
		id: 'view.zoomOut',
		keys: ['Mod+-'],
		label: 'Zoom out',
		group: 'View',
		run: (ctx) => zoomStep(ctx, -1)
	}
];
