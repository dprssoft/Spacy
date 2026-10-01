import { toast } from 'svelte-sonner';
import type { BoardContext } from '../context';
import { definitionOf } from '../elements';
import { fitRect } from '../engine/viewport';
import { closeFocus } from './focus';

let pulses = 0;

/** Brings a mentioned object into view, selects it and pulses it (closing focus mode first). */
export function jumpToElement(ctx: BoardContext, id: string): boolean {
	const el = ctx.store.get(id);
	if (!el) {
		toast('This object was deleted');
		return false;
	}
	closeFocus(ctx.id);
	ctx.editing.end();
	const rect = definitionOf(el).aabb(el, ctx.store.world);
	ctx.viewport.animateTo(fitRect(rect, ctx.viewport.size, 120, 1));
	ctx.selection.set([id]);
	ctx.preview.pulse = { id, n: ++pulses };
	return true;
}
