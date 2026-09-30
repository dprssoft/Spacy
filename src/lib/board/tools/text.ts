import type { BoardContext } from '../context';
import { createText } from './create';
import type { Tool } from './types';

/** Click to place a text and start typing. Left empty, it disappears (see TextEditing). */
export function createTextTool(ctx: BoardContext): Tool {
	return {
		id: 'text',
		cursor: 'text',
		onPointerDown() {},
		onPointerMove() {},
		onPointerUp(e) {
			ctx.undo.stopCapturing();
			const id = createText(ctx, e.world);
			ctx.tools.returnToSelect();
			ctx.editing.start(id, { discardIfEmpty: true });
		},
		onCancel() {}
	};
}
