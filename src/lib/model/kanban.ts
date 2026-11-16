// Smart kanban: frames sharing a `kanban` board id are its columns, the column a card sits in is
// its status, and cards stack top to bottom in each column. Pure helpers plus the doc-level
// relayout every change to a column goes through.
import type * as Y from 'yjs';
import { getElementsMap } from './doc';
import { beforeDeleteHooks, updateElements } from './ops';
import type { Element, ElementPatch, FrameElement, Point, Rect } from './types';
import { compareZ } from './zorder';

export const KANBAN = {
	// The same spacing as "Stack contents" (`engine/align.ts`), so the two agree on a column.
	/** Space between a column's edge and its cards. */
	pad: 16,
	/** Space between cards. */
	gap: 12,
	/** Height of the "Add task" button under the last card. */
	addH: 36
} as const;

export type KanbanColumn = FrameElement & { kanban: string };
type Card = Pick<Element, 'id' | 'x' | 'y' | 'w' | 'h' | 'z'>;

export const isColumn = (el: Element | null | undefined): el is KanbanColumn =>
	el?.type === 'frame' && !!el.kanban;

/** Cards that stack in a column: everything in it but connectors. */
export const stacksIn = (el: Element, columnId: string): boolean =>
	el.parentId === columnId && el.type !== 'connector' && el.type !== 'frame';

/** The columns of one board, left to right. */
export function boardColumns(els: Iterable<Element>, board: string): KanbanColumn[] {
	const out: KanbanColumn[] = [];
	for (const el of els) if (isColumn(el) && el.kanban === board) out.push(el);
	return out.sort((a, b) => a.x - b.x || a.y - b.y);
}

/** The topmost column whose box holds `p`: a card joins the column its center is over. */
export function columnAt(p: Point, columns: readonly KanbanColumn[]): KanbanColumn | null {
	let best: KanbanColumn | null = null;
	for (const c of columns) {
		if (p.x < c.x || p.y < c.y || p.x > c.x + c.w || p.y > c.y + c.h) continue;
		if (!best || compareZ(c.z, best.z) > 0) best = c;
	}
	return best;
}

/** The color of a column's top sticky (other than `except`): the color its cards take. */
export function cardColorIn(
	els: Iterable<Element>,
	columnId: string,
	except?: string
): string | null {
	let top: Extract<Element, { type: 'sticky' }> | null = null;
	for (const el of els) {
		if (el.type !== 'sticky' || el.parentId !== columnId || el.id === except) continue;
		if (!top || el.y < top.y) top = el;
	}
	return top?.color ?? null;
}

const byOrder = (a: Card, b: Card) => a.y - b.y || compareZ(a.z, b.z);

/**
 * Cards stacked in a column in the order of their top edges, so where a card is dropped sets its
 * place. Returns the moves and the height the column needs for them plus the "Add task" button.
 */
export function stackCards(
	column: Rect,
	cards: readonly Card[]
): { patches: { id: string; patch: ElementPatch }[]; height: number } {
	const { pad, gap, addH } = KANBAN;
	const x = column.x + pad;
	const w = Math.max(40, column.w - 2 * pad);
	const patches: { id: string; patch: ElementPatch }[] = [];
	let y = column.y + pad;
	for (const card of [...cards].sort(byOrder)) {
		const patch: ElementPatch = {};
		if (Math.abs(card.x - x) > 0.01) patch.x = x;
		if (Math.abs(card.y - y) > 0.01) patch.y = y;
		if (Math.abs(card.w - w) > 0.01) patch.w = w;
		if (Object.keys(patch).length) patches.push({ id: card.id, patch });
		y += card.h + gap;
	}
	return { patches, height: y - column.y + addH + pad };
}

/** Where a new card goes: below the last one (or under `after`, which sorts it right after it). */
export function nextCardY(column: Rect, cards: readonly Card[], after?: Card): number {
	if (after) return after.y + 0.5;
	let bottom = column.y + KANBAN.pad;
	for (const c of cards) bottom = Math.max(bottom, c.y + c.h + KANBAN.gap);
	return bottom;
}

/**
 * Restacks the given columns and grows any that its cards no longer fit (columns never shrink by
 * themselves). `gone`: elements being deleted. Joins the current transaction when there is one.
 */
export function relayoutColumns(
	doc: Y.Doc,
	columnIds: Iterable<string>,
	gone: ReadonlySet<string> = new Set()
): void {
	const wanted = new Set(columnIds);
	if (wanted.size === 0) return;
	const els = [...getElementsMap(doc).values()].map((m) => m.toJSON() as Element);
	const cards = new Map<string, Element[]>();
	for (const el of els) {
		if (!el.parentId || !wanted.has(el.parentId) || gone.has(el.id)) continue;
		if (!stacksIn(el, el.parentId)) continue;
		cards.set(el.parentId, [...(cards.get(el.parentId) ?? []), el]);
	}
	const patches: { id: string; patch: ElementPatch }[] = [];
	for (const col of els) {
		if (!wanted.has(col.id) || gone.has(col.id) || !isColumn(col)) continue;
		const stacked = stackCards(col, cards.get(col.id) ?? []);
		patches.push(...stacked.patches);
		if (stacked.height > col.h + 0.01) patches.push({ id: col.id, patch: { h: stacked.height } });
	}
	if (patches.length) updateElements(doc, patches);
}

// Deleting a card closes the gap it leaves, in the same transaction (so in the same undo step).
beforeDeleteHooks.push((doc, ids) => {
	const map = getElementsMap(doc);
	const columns = new Set<string>();
	for (const id of ids) {
		const parentId = map.get(id)?.toJSON().parentId;
		if (typeof parentId === 'string' && !ids.has(parentId)) columns.add(parentId);
	}
	relayoutColumns(doc, columns, ids);
});
