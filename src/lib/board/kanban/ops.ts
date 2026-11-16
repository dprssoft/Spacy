import { STICKY_COLORS, DEFAULT_SIZES, newElementBase } from '$lib/model/defaults';
import { newId } from '$lib/model/ids';
import {
	boardColumns,
	cardColorIn,
	isColumn,
	nextCardY,
	relayoutColumns,
	rememberCardColors,
	stacksIn,
	KANBAN,
	type KanbanColumn
} from '$lib/model/kanban';
import { createElements, updateElements } from '$lib/model/ops';
import { LOCAL } from '$lib/model/origins';
import type { Element, NewElement, StickyElement } from '$lib/model/types';
import type { BoardContext } from '../context';
import { getDefaultStyle } from '../style/styleDefaults';

/** The kanban column an element is a card of, if any. */
export function columnOf(ctx: BoardContext, el: Element): KanbanColumn | null {
	const parent = el.parentId ? ctx.store.get(el.parentId) : undefined;
	return isColumn(parent) ? parent : null;
}

/** The columns of the board `column` belongs to, left to right. */
export const columnsOfBoard = (ctx: BoardContext, column: KanbanColumn): KanbanColumn[] =>
	boardColumns(ctx.store.elements.values(), column.kanban);

const cardsIn = (ctx: BoardContext, columnId: string): Element[] =>
	[...ctx.store.elements.values()].filter((el) => stacksIn(el, columnId));

/** Sets a card's status: it moves to the end of `columnId` and takes that column's card color. */
export function moveCardTo(ctx: BoardContext, cardId: string, columnId: string): void {
	const card = ctx.store.get(cardId);
	const to = ctx.store.get(columnId);
	if (!card || !isColumn(to) || card.parentId === columnId) return;
	const from = card.parentId;
	const color = card.type === 'sticky' ? cardColorIn(ctx.store.elements.values(), columnId) : null;
	ctx.undo.stopCapturing();
	ctx.doc.transact(() => {
		// Before the card leaves: if it's the last one there, its old column keeps its color.
		if (from) rememberCardColors(ctx.doc, [from]);
		updateElements(ctx.doc, [
			{
				id: cardId,
				patch: {
					parentId: columnId,
					x: to.x + KANBAN.pad,
					y: nextCardY(to, cardsIn(ctx, columnId)),
					...(color ? { color } : {})
				}
			}
		]);
		relayoutColumns(ctx.doc, from ? [from, columnId] : [columnId]);
	}, LOCAL);
	ctx.undo.stopCapturing();
}

/**
 * Adds an empty card to a column (under `afterId`, or at the end) and starts typing on it. An
 * untouched new card disappears again when editing ends.
 */
export function addTask(ctx: BoardContext, columnId: string, afterId?: string): string | null {
	const column = ctx.store.get(columnId);
	if (!isColumn(column)) return null;
	const cards = cardsIn(ctx, columnId);
	const after = afterId ? cards.find((c) => c.id === afterId) : undefined;
	const last = [...cards].sort((a, b) => b.y - a.y)[0];
	const id = newId();
	const sticky: Omit<StickyElement, 'z'> = {
		...newElementBase('sticky', id, { x: 0, y: 0 }, getDefaultStyle('sticky')),
		type: 'sticky',
		x: column.x + KANBAN.pad,
		y: nextCardY(column, cards, after),
		w: Math.max(40, column.w - 2 * KANBAN.pad),
		h: (after ?? last)?.h ?? Math.min(DEFAULT_SIZES.sticky.h, 110),
		parentId: columnId,
		text: '',
		color: cardColorIn(ctx.store.elements.values(), columnId) ?? STICKY_COLORS.yellow
	};
	ctx.undo.stopCapturing();
	ctx.doc.transact(() => {
		createElements(ctx.doc, [sticky]);
		relayoutColumns(ctx.doc, [columnId]);
	}, LOCAL);
	ctx.tools.setTool('select');
	ctx.editing.start(id, { discardIfEmpty: true });
	return id;
}

/**
 * Kanban cards copied without their column: they become empty cards right under the originals,
 * in the same column, instead of copies of the text. Returns their ids (in `els`).
 */
export function looseCards(ctx: BoardContext, els: readonly Element[]): Set<string> {
	const ids = new Set(els.map((e) => e.id));
	const out = new Set<string>();
	for (const el of els) {
		if (el.type !== 'sticky' || !el.parentId || ids.has(el.parentId)) continue;
		if (isColumn(ctx.store.get(el.parentId))) out.add(el.id);
	}
	return out;
}

/** Boards of which `els` holds some columns but not all: their copies stay on the same board. */
export function partlyCopiedBoards(ctx: BoardContext, els: readonly Element[]): Set<string> {
	const ids = new Set(els.map((e) => e.id));
	const out = new Set<string>();
	for (const el of els) {
		if (!isColumn(el) || !ctx.store.get(el.id)) continue;
		if (boardColumns(ctx.store.elements.values(), el.kanban).some((c) => !ids.has(c.id)))
			out.add(el.kanban);
	}
	return out;
}

/** The copies of `loose` cards (see `looseCards`), emptied and placed right under the originals. */
export function blankCopies(
	els: readonly Element[],
	copies: readonly NewElement[],
	loose: ReadonlySet<string>
): NewElement[] {
	return copies.map((copy, i) => {
		const src = els[i];
		if (!src || !loose.has(src.id) || copy.type !== 'sticky') return copy;
		return { ...copy, x: src.x, y: src.y + 0.5, text: '' };
	});
}

/** `idMap` without the loose cards: their comments stay on the originals. */
export function withoutLoose(
	idMap: ReadonlyMap<string, string>,
	loose: ReadonlySet<string>
): Map<string, string> {
	return new Map([...idMap].filter(([oldId]) => !loose.has(oldId)));
}
