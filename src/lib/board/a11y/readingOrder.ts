import type { Rect } from '$lib/model/types';

/**
 * Ids in reading order: rows from top to bottom, left to right within a row. An item joins the
 * current row when its vertical center lies within the row's first item.
 */
export function readingOrder(items: readonly { id: string; rect: Rect }[]): string[] {
	const byTop = [...items].sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
	const rows: { top: number; bottom: number; items: typeof byTop }[] = [];
	for (const item of byTop) {
		const center = item.rect.y + item.rect.h / 2;
		const row = rows.at(-1);
		if (row && center >= row.top && center <= row.bottom) row.items.push(item);
		else rows.push({ top: item.rect.y, bottom: item.rect.y + item.rect.h, items: [item] });
	}
	return rows.flatMap((r) =>
		r.items.sort((a, b) => a.rect.x - b.rect.x || a.rect.y - b.rect.y).map((i) => i.id)
	);
}

/**
 * The id to select next when cycling with Tab (or Shift+Tab). Returns null past either end, so
 * focus can leave the canvas (no keyboard trap).
 */
export function nextInOrder(
	order: readonly string[],
	current: string | null,
	back: boolean
): string | null {
	if (order.length === 0) return null;
	const i = current ? order.indexOf(current) : -1;
	if (i === -1) return (back ? order.at(-1) : order[0]) ?? null;
	return order[i + (back ? -1 : 1)] ?? null;
}
