import type { BoardContext } from '../context';
import { syncFrameMembership } from '../frameMembership';
import { createSticky } from './create';
import type { Tool } from './types';

/** Click to place a sticky note and start typing. */
export function createStickyTool(ctx: BoardContext): Tool {
	return {
		id: 'sticky',
		cursor: 'crosshair',
		onPointerDown() {},
		onPointerMove() {},
		onPointerUp(e) {
			ctx.undo.stopCapturing();
			const id = createSticky(ctx, e.world);
			syncFrameMembership(ctx, [id]);
			ctx.tools.returnToSelect();
			ctx.editing.start(id);
		},
		onCancel() {}
	};
}
