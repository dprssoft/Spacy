import type { BoardContext } from '../context';
import { syncFrameMembership } from '../frameMembership';
import { createDocCard } from './create';
import type { Tool } from './types';

/** Click to place a doc card and start writing in it. */
export function createDocCardTool(ctx: BoardContext): Tool {
	return {
		id: 'doccard',
		cursor: 'crosshair',
		onPointerDown() {},
		onPointerMove() {},
		onPointerUp(e) {
			ctx.undo.stopCapturing();
			const id = createDocCard(ctx, e.world);
			syncFrameMembership(ctx, [id]);
			ctx.tools.returnToSelect();
			ctx.editing.start(id);
		},
		onCancel() {}
	};
}
