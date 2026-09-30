import type { BoardContext } from '../context';
import { definitionOf } from '../elements';
import { createText } from './create';
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
		onDoubleClick(e) {
			const id = e.hit.elementId;
			const el = id ? ctx.store.get(id) : undefined;
			if (el && !el.locked && definitionOf(el).editableText) {
				ctx.editing.start(el.id);
			} else if (!id) {
				// Whiteboard convenience: double-click empty canvas to write.
				ctx.undo.stopCapturing();
				ctx.editing.start(createText(ctx, e.world), { discardIfEmpty: true });
			}
		},
		onKeyDown(e) {
			if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return false;
			const id = ctx.selection.single;
			const el = id ? ctx.store.get(id) : undefined;
			if (!el || el.locked || !definitionOf(el).editableText) return false;
			ctx.editing.start(el.id);
			return true;
		},
		onCancel() {}
	};
}
