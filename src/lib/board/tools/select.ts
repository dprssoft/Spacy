import type { BoardContext } from '../context';
import type { Tool } from './types';

/** Minimal select tool: click selects (Shift toggles), empty canvas clears. Step 13 completes it. */
export function createSelectTool(ctx: BoardContext): Tool {
	return {
		id: 'select',
		cursor: 'default',
		onPointerDown(e) {
			const id = e.hit.elementId;
			if (id) {
				if (e.shift) ctx.selection.toggle(id);
				else if (!ctx.selection.has(id)) ctx.selection.set([id]);
			} else if (!e.shift) {
				ctx.selection.clear();
			}
		},
		onPointerMove() {},
		onPointerUp() {},
		onCancel() {}
	};
}
