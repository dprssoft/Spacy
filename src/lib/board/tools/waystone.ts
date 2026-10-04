import type { BoardContext } from '../context';
import type { Tool } from './types';

/** Click (tap) to place a waystone that arrives at the current zoom. */
export function createWaystoneTool(ctx: BoardContext): Tool {
	return {
		id: 'waystone',
		cursor: 'crosshair',
		onPointerDown() {},
		onPointerMove() {},
		onPointerUp(e) {
			const id = ctx.waystones.add(e.world);
			ctx.tools.returnToSelect();
			ctx.selection.set([id]);
		},
		onCancel() {}
	};
}
