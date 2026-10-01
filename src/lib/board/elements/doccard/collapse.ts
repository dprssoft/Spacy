import { DOC_CARD_HEADER_H } from '$lib/model/defaults';
import { updateElement } from '$lib/model/ops';
import type { DocCardElement } from '$lib/model/types';
import type { BoardContext } from '../../context';

export const DOC_CARD_MIN = { w: 240, h: 120 };

/** Collapses a card to its header (remembering its height) or expands it back, as one undo step. */
export function setCollapsed(ctx: BoardContext, el: DocCardElement, collapsed: boolean): void {
	if (el.collapsed === collapsed) return;
	ctx.undo.stopCapturing();
	updateElement(
		ctx.doc,
		el.id,
		collapsed
			? { collapsed, expandedH: el.h, h: DOC_CARD_HEADER_H }
			: { collapsed, h: Math.max(DOC_CARD_MIN.h, el.expandedH) }
	);
	ctx.undo.stopCapturing();
}

export function docCardLimits(el: DocCardElement) {
	return el.collapsed
		? { minW: DOC_CARD_MIN.w, minH: DOC_CARD_HEADER_H, maxH: DOC_CARD_HEADER_H }
		: { minW: DOC_CARD_MIN.w, minH: DOC_CARD_MIN.h };
}
