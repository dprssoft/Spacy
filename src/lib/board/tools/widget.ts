import type { BoardContext } from '../context';
import { createWidgetAt } from '../widgets/create';
import type { Tool } from './types';

/** Click (tap) to place the widget picked in the Widgets menu. */
export function createWidgetTool(ctx: BoardContext): Tool {
	return {
		id: 'widget',
		cursor: 'crosshair',
		onPointerDown() {},
		onPointerMove() {},
		onPointerUp(e) {
			const id = createWidgetAt(ctx, ctx.tools.widgetKind, e.world);
			ctx.tools.returnToSelect();
			if (id) ctx.selection.set([id]);
		},
		onCancel() {}
	};
}
