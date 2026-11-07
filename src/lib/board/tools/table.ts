import type { BoardContext } from '../context';
import { syncFrameMembership } from '../frameMembership';
import { createTable } from './create';
import type { Tool } from './types';

/** Click to place a table and start typing in its first cell. */
export function createTableTool(ctx: BoardContext): Tool {
	return {
		id: 'table',
		cursor: 'crosshair',
		onPointerDown() {},
		onPointerMove() {},
		onPointerUp(e) {
			ctx.undo.stopCapturing();
			const id = createTable(ctx, e.world);
			syncFrameMembership(ctx, [id]);
			ctx.undo.stopCapturing();
			ctx.tools.returnToSelect();
			ctx.editing.start(id);
		},
		onCancel() {}
	};
}
