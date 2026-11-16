import { describe, expect, it } from 'vitest';
import { KANBAN } from '$lib/model/kanban';
import { createElements, deleteElements, updateElements } from '$lib/model/ops';
import { samples } from '$lib/model/testFixtures';
import type { Element, FrameElement, StickyElement } from '$lib/model/types';
import '$lib/board/elements';
import { templates } from '$lib/templates/index';
import { insertTemplate } from '$lib/templates/insert';
import { copySelectionText, pasteText } from '../commands/clipboard';
import { duplicateSelection } from '../commands/edit';
import { syncFrameMembership } from '../frameMembership';
import { testCtx } from '../testCtx';
import { addTask, moveCardTo } from './ops';

const { pad, gap } = KANBAN;
const column = (id: string, x: number, board = 'b1', z = 'a0'): FrameElement => ({
	...samples.frame(id, z),
	x,
	y: 0,
	w: 320,
	h: 600,
	title: id,
	kanban: board
});
const card = (id: string, parentId: string, x: number, y: number, color = '#ffe066') =>
	({
		...samples.sticky(id, 'b' + id),
		x,
		y,
		w: 320 - 2 * pad,
		h: 100,
		parentId,
		color,
		text: id
	}) as StickyElement;

/** A board with To do (t1, t2) and Done (d1, green). */
function setup(...extra: Element[]) {
	const ctx = testCtx();
	createElements(ctx.doc, [
		column('todo', 0),
		column('done', 400),
		card('t1', 'todo', pad, pad),
		card('t2', 'todo', pad, pad + 100 + gap),
		card('d1', 'done', 400 + pad, pad, '#b2f2bb'),
		...extra
	]);
	return ctx;
}
const get = (ctx: ReturnType<typeof testCtx>, id: string) => ctx.store.get(id)!;
const cardsOf = (ctx: ReturnType<typeof testCtx>, col: string) =>
	[...ctx.store.elements.values()]
		.filter((e) => e.parentId === col)
		.sort((a, b) => a.y - b.y)
		.map((e) => e.id);

describe('smart kanban', () => {
	it('changing status moves the card to the end of the column, in its color, closing the gap', () => {
		const ctx = setup();
		moveCardTo(ctx, 't1', 'done');
		expect(cardsOf(ctx, 'done')).toEqual(['d1', 't1']);
		expect(get(ctx, 't1')).toMatchObject({ x: 400 + pad, y: pad + 100 + gap, color: '#b2f2bb' });
		expect(get(ctx, 't2').y).toBe(pad);
		ctx.history.undo();
		expect(get(ctx, 't1')).toMatchObject({ parentId: 'todo', y: pad, color: '#ffe066' });
	});

	it('dragging a card reorders its column and dropping it in another column moves it there', () => {
		const ctx = setup();
		updateElements(ctx.doc, [{ id: 't2', patch: { x: 60, y: -40 } }]);
		syncFrameMembership(ctx, ['t2']);
		expect(cardsOf(ctx, 'todo')).toEqual(['t2', 't1']);
		expect(get(ctx, 't2')).toMatchObject({ x: pad, y: pad });

		// Partly outside the column, but its center is over Done.
		updateElements(ctx.doc, [{ id: 't1', patch: { x: 380, y: 300 } }]);
		syncFrameMembership(ctx, ['t1']);
		expect(cardsOf(ctx, 'done')).toEqual(['d1', 't1']);
		expect(get(ctx, 't1')).toMatchObject({ color: '#b2f2bb', x: 400 + pad });
	});

	it('columns grow when their cards no longer fit', () => {
		const ctx = setup();
		for (let i = 0; i < 6; i++) {
			const id = addTask(ctx, 'done')!;
			updateElements(ctx.doc, [{ id, patch: { text: `Task ${i}` } }]);
		}
		ctx.editing.end();
		const done = get(ctx, 'done');
		const last = get(ctx, cardsOf(ctx, 'done').at(-1)!);
		expect(done.h).toBeGreaterThan(600);
		expect(last.y + last.h).toBeLessThanOrEqual(done.y + done.h - KANBAN.addH);
	});

	it('deleting a card closes the gap', () => {
		const ctx = setup();
		deleteElements(ctx.doc, ['t1']);
		expect(get(ctx, 't2').y).toBe(pad);
	});

	it('adds a task at the end, or right after a card, ready to type; an empty one goes away', () => {
		const ctx = setup();
		const id = addTask(ctx, 'todo', 't1')!;
		expect(cardsOf(ctx, 'todo')).toEqual(['t1', id, 't2']);
		expect(get(ctx, id)).toMatchObject({
			type: 'sticky',
			text: '',
			color: '#ffe066',
			w: 320 - 2 * pad
		});
		expect(ctx.selection.editingId).toBe(id);
		ctx.editing.end();
		expect(ctx.store.get(id)).toBeUndefined();
		expect(cardsOf(ctx, 'todo')).toEqual(['t1', 't2']);
		expect(get(ctx, 't2').y).toBe(pad + 100 + gap);
	});

	it('duplicating a card gives an empty card under it in the same column, ready to type', () => {
		const ctx = setup();
		ctx.selection.set(['t1']);
		duplicateSelection(ctx);
		const [copy] = ctx.selection.ids;
		expect(get(ctx, copy!)).toMatchObject({ parentId: 'todo', text: '' });
		expect(cardsOf(ctx, 'todo')).toEqual(['t1', copy, 't2']);
		expect(ctx.selection.editingId).toBe(copy);
	});

	it('copy and paste of a card does the same', async () => {
		const ctx = setup();
		ctx.selection.set(['d1']);
		await pasteText(ctx, copySelectionText(ctx)!);
		const [copy] = ctx.selection.ids;
		expect(get(ctx, copy!)).toMatchObject({ parentId: 'done', text: '', color: '#b2f2bb' });
		expect(cardsOf(ctx, 'done')).toEqual(['d1', copy]);
	});

	it('a duplicated column joins the same board; a duplicated board is a board of its own', () => {
		const ctx = setup();
		ctx.selection.set(['done']);
		duplicateSelection(ctx, { x: 400, y: 0 });
		const frames = () => [...ctx.store.elements.values()].filter((e) => e.type === 'frame');
		const copy = frames().find((f) => f.id !== 'todo' && f.id !== 'done') as FrameElement;
		expect(copy.kanban).toBe('b1');
		// Its cards keep their text: the column was copied with them.
		expect(
			[...ctx.store.elements.values()].some(
				(e) => e.parentId === copy.id && 'text' in e && e.text === 'd1'
			)
		).toBe(true);

		ctx.selection.set(frames().map((f) => f.id));
		duplicateSelection(ctx, { x: 0, y: 1000 });
		const boards = new Set(frames().map((f) => (f as FrameElement).kanban));
		expect(boards.size).toBe(2);
	});

	it('two inserted kanban templates are separate boards whose cards move only within their own', async () => {
		const ctx = testCtx();
		const kanban = templates.find((t) => t.id === 'kanban')!;
		await insertTemplate(ctx, kanban);
		await insertTemplate(ctx, kanban);
		const columns = [...ctx.store.elements.values()].filter(
			(e): e is FrameElement => e.type === 'frame'
		);
		expect(columns).toHaveLength(6);
		expect(new Set(columns.map((c) => c.kanban)).size).toBe(2);
		for (const c of columns) expect(c.kanban).toBeTruthy();
	});

	it('a card moved into an emptied column still takes that column’s color', () => {
		const ctx = setup();
		// Done's only card leaves (by status), then To do's cards leave by status and by drag.
		moveCardTo(ctx, 'd1', 'todo');
		expect(get(ctx, 'd1')).toMatchObject({ color: '#ffe066' });
		expect(get(ctx, 'done')).toMatchObject({ cardColor: '#b2f2bb' });
		moveCardTo(ctx, 't1', 'done');
		expect(get(ctx, 't1')).toMatchObject({ color: '#b2f2bb' });

		// A card recolored by hand: its column takes the new color when it's the last one to go.
		updateElements(ctx.doc, [{ id: 't1', patch: { color: '#ffc9c9' } }]);
		updateElements(ctx.doc, [{ id: 't1', patch: { x: 60, y: 300 } }]);
		syncFrameMembership(ctx, ['t1']);
		expect(get(ctx, 't1')).toMatchObject({ parentId: 'todo', color: '#ffe066' });
		expect(get(ctx, 'done')).toMatchObject({ cardColor: '#ffc9c9' });
		moveCardTo(ctx, 't2', 'done');
		expect(get(ctx, 't2')).toMatchObject({ color: '#ffc9c9' });
		const id = addTask(ctx, 'done')!;
		expect(get(ctx, id)).toMatchObject({ color: '#ffc9c9' });
	});

	it('the kanban template’s columns know their card colors before any card moves', async () => {
		const ctx = testCtx();
		await insertTemplate(
			ctx,
			templates.find((t) => t.id === 'kanban')!
		);
		const els = [...ctx.store.elements.values()];
		for (const c of els.filter((e): e is FrameElement => e.type === 'frame')) {
			const cards = els.filter(
				(e): e is StickyElement => e.parentId === c.id && e.type === 'sticky'
			);
			expect(cards.length).toBeGreaterThan(0);
			for (const card of cards) expect(card.color).toBe(c.cardColor);
		}
	});
});
