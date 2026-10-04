import type { DocCardElement, FrameElement, Rect } from '$lib/model/types';

// The manuscript outline (pure): chapters are frames in reading order, scenes are the doc cards
// inside them; cards outside frames come last. A stored order (meta.outline) wins; cards it
// doesn't list follow in reading order.

export interface Chapter {
	frame: FrameElement | null;
	cards: DocCardElement[];
}

/** Rows first (tops within ROW_TOLERANCE are one row), then left to right. */
const ROW_TOLERANCE = 100;
export function readingCompare(a: Rect, b: Rect): number {
	return Math.abs(a.y - b.y) < ROW_TOLERANCE ? a.x - b.x || a.y - b.y : a.y - b.y;
}

export function outlineChapters(
	cards: readonly DocCardElement[],
	frames: readonly FrameElement[],
	stored: readonly string[]
): Chapter[] {
	const rank = new Map(stored.map((id, i) => [id, i]));
	const byOrder = (a: DocCardElement, b: DocCardElement) => {
		const ra = rank.get(a.id);
		const rb = rank.get(b.id);
		if (ra !== undefined && rb !== undefined) return ra - rb;
		if (ra !== undefined) return -1;
		if (rb !== undefined) return 1;
		return readingCompare(a, b);
	};
	const frameIds = new Set(frames.map((f) => f.id));
	const chapters: Chapter[] = [...frames].sort(readingCompare).map((frame) => ({
		frame,
		cards: cards.filter((c) => c.parentId === frame.id).sort(byOrder)
	}));
	const loose = cards.filter((c) => !c.parentId || !frameIds.has(c.parentId)).sort(byOrder);
	return [
		...chapters.filter((c) => c.cards.length > 0),
		...(loose.length ? [{ frame: null, cards: loose }] : [])
	];
}

/** The whole manuscript, in order. */
export const outlineIds = (chapters: readonly Chapter[]) =>
	chapters.flatMap((c) => c.cards.map((x) => x.id));

/**
 * The stored order after moving `id` to position `index` of the chapter of frame `toFrame`
 * (null: the cards outside frames). Index counts the target chapter's cards without `id`.
 */
export function moveInOutline(
	chapters: readonly Chapter[],
	id: string,
	toFrame: string | null,
	index: number
): string[] {
	const moved = chapters.flatMap((c) => c.cards).find((c) => c.id === id);
	if (!moved) return outlineIds(chapters);
	const next = chapters.map((c) => ({ frame: c.frame, cards: c.cards.filter((x) => x.id !== id) }));
	let target = next.find((c) => (c.frame?.id ?? null) === toFrame);
	if (!target) {
		target = { frame: null, cards: [] };
		next.push(target);
	}
	target.cards.splice(Math.max(0, Math.min(index, target.cards.length)), 0, moved);
	return outlineIds(next);
}
