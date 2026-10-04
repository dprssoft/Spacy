import { toast } from 'svelte-sonner';
import type { BoardContext } from '../context';
import { definitionOf } from '../elements';
import { fitRect } from '../engine/viewport';
import { closeFocus } from './focus';

let pulses = 0;

/** The mentioned element id when `target` is (inside) a mention chip. */
export function mentionAt(target: EventTarget | null): string | null {
	if (!(target instanceof Element)) return null;
	return target.closest<HTMLElement>('.mention[data-id]')?.dataset.id ?? null;
}

/** The comment thread id when `target` is (inside) commented text. */
export function commentAt(target: EventTarget | null): string | null {
	if (!(target instanceof Element)) return null;
	return target.closest<HTMLElement>('[data-comment]')?.dataset.comment ?? null;
}

/** Brings a mentioned object into view, selects it and pulses it (closing focus mode first). */
export function jumpToElement(ctx: BoardContext, id: string): boolean {
	// The object may be on another page: go there first.
	if (!ctx.store.get(id)) ctx.pages?.reveal(id);
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
