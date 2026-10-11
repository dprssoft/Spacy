import type { Element } from '$lib/model/types';
import type { BoardContext } from '../context';
import { unionRects } from '../engine/geometry';

const textOf = (el: Element): string =>
	el.type === 'sticky' || el.type === 'shape' || el.type === 'text'
		? el.text.replace(/\s+/g, ' ').trim()
		: '';

/** The selected stickies, shapes and texts, top to bottom then left to right. */
function textElements(ctx: Pick<BoardContext, 'selection' | 'store'>): Element[] {
	return [...ctx.selection.ids]
		.map((id) => ctx.store.get(id))
		.filter((el): el is Element => !!el && textOf(el) !== '')
		.sort((a, b) => a.y - b.y || a.x - b.x);
}

/** Their texts, for a wheel's segments or a randomizer's items. */
export const selectedTexts = (ctx: Pick<BoardContext, 'selection' | 'store'>): string[] =>
	textElements(ctx).map(textOf);

/** Where a widget made from the selection goes: right of it, top-aligned (world point = its centre). */
export function besideSelection(
	ctx: Pick<BoardContext, 'selection' | 'store'>,
	size: { w: number; h: number }
) {
	const b = unionRects(textElements(ctx).flatMap((el) => ctx.store.index.get(el.id) ?? []));
	return b ? { x: b.x + b.w + 60 + size.w / 2, y: b.y + size.h / 2 } : null;
}
