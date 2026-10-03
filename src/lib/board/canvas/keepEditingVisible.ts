import { keepInView, keyboard } from '$lib/shared/keyboard.svelte';
import type { BoardContext } from '../context';

/**
 * While something is edited on a touch screen, pans the board so the edited element (or, inside
 * a doc card, the caret's line) stays above the on-screen keyboard and the bar docked on it.
 */
export function keepEditingVisible(
	ctx: BoardContext,
	canvas: HTMLElement,
	barHeight: number
): void {
	const id = ctx.selection.editingId;
	if (!id) return;
	const node = canvas.querySelector(`[data-element-id="${CSS.escape(id)}"]`);
	if (!node) return;
	let rect: { top: number; bottom: number } = node.getBoundingClientRect();
	const sel = document.getSelection();
	if (sel && sel.rangeCount > 0 && sel.anchorNode && node.contains(sel.anchorNode)) {
		const caret = sel.getRangeAt(0).getBoundingClientRect();
		if (caret.height > 0) rect = caret;
	}
	const top = canvas.getBoundingClientRect().top;
	const bottom = Math.min(
		canvas.getBoundingClientRect().bottom,
		keyboard.visibleBottom - barHeight
	);
	const dy = keepInView(rect, top, bottom);
	if (dy) ctx.viewport.panBy(0, dy);
}
