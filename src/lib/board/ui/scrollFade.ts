import type { Attachment } from 'svelte/attachments';

/** Width of the fade at a clipped edge, in px. */
const FADE = 32;

/**
 * CSS mask that fades out whichever edges of a horizontal scroller hide more content.
 * Returns `none` when nothing is clipped.
 */
export function fadeMask(scrollLeft: number, scrollWidth: number, clientWidth: number): string {
	const left = scrollLeft > 1;
	const right = scrollLeft + clientWidth < scrollWidth - 1;
	if (!left && !right) return 'none';
	const start = left ? `transparent, #000 ${FADE}px` : '#000';
	const end = right ? `#000 calc(100% - ${FADE}px), transparent` : '#000';
	return `linear-gradient(to right, ${start}, ${end})`;
}

/**
 * Hides the scrollbar of a horizontal strip, fades its clipped edges so the user can tell
 * there's more, and lets a plain mouse wheel scroll it sideways.
 */
export const scrollFade: Attachment<HTMLElement> = (node) => {
	node.style.scrollbarWidth = 'none';
	const update = () => {
		const mask = fadeMask(node.scrollLeft, node.scrollWidth, node.clientWidth);
		node.style.maskImage = mask;
		node.style.setProperty('-webkit-mask-image', mask);
	};
	const onWheel = (e: WheelEvent) => {
		if (e.ctrlKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
		if (node.scrollWidth <= node.clientWidth) return;
		e.preventDefault();
		node.scrollLeft += e.deltaY;
	};
	const resize = new ResizeObserver(update);
	resize.observe(node);
	// Tabs added, removed or renamed change the content width without resizing the strip.
	const mutations = new MutationObserver(update);
	mutations.observe(node, { childList: true, subtree: true, characterData: true });
	node.addEventListener('scroll', update, { passive: true });
	node.addEventListener('wheel', onWheel, { passive: false });
	update();
	return () => {
		resize.disconnect();
		mutations.disconnect();
		node.removeEventListener('scroll', update);
		node.removeEventListener('wheel', onWheel);
	};
};
