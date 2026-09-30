import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { getDocsMap } from '$lib/model/doc';
import { createElements } from '$lib/model/ops';
import { samples } from '$lib/model/testFixtures';
import type { Element } from '$lib/model/types';
import { testCtx } from '../testCtx';
import {
	deleteSelection,
	duplicateSelection,
	groupSelection,
	reorderSelection,
	toggleLock,
	ungroupSelection
} from './edit';

function setup(...els: Element[]) {
	const ctx = testCtx();
	createElements(ctx.doc, els);
	return ctx;
}

describe('edit commands', () => {
	it('deletes the selection except locked elements, as one undo step', () => {
		const ctx = setup(samples.shape('a'), samples.sticky('b'), {
			...samples.text('c'),
			locked: true
		});
		ctx.selection.set(['a', 'b', 'c']);
		deleteSelection(ctx);
		expect([...ctx.store.elements.keys()]).toEqual(['c']);
		expect(ctx.selection.size).toBe(0);
		ctx.history.undo();
		expect(ctx.store.elements.size).toBe(3);
	});

	it('duplicates with an offset, new ids, stacking order kept, copies selected', () => {
		const ctx = setup(samples.shape('a', 'a1'), samples.sticky('b', 'a2'));
		ctx.selection.set(['b', 'a']);
		duplicateSelection(ctx);
		const copies = [...ctx.selection.ids].map((id) => ctx.store.get(id)!);
		expect(copies).toHaveLength(2);
		expect(copies.every((c) => c.id !== 'a' && c.id !== 'b')).toBe(true);
		const copyA = copies.find((c) => c.type === 'shape')!;
		const copyB = copies.find((c) => c.type === 'sticky')!;
		expect(copyA.x).toBe(samples.shape().x + 16);
		expect(copyA.z < copyB.z).toBe(true);
		expect(copyA.z > ctx.store.get('b')!.z).toBe(true);
		ctx.history.undo();
		expect(ctx.store.elements.size).toBe(2);
	});

	it('duplicates doc card contents', () => {
		const ctx = setup(samples.doccard('d'));
		const frag = getDocsMap(ctx.doc).get('d')!;
		ctx.doc.transact(() => frag.insert(0, [new Y.XmlText('Hello doc')]));
		ctx.selection.set(['d']);
		duplicateSelection(ctx);
		const copyId = [...ctx.selection.ids][0]!;
		expect(getDocsMap(ctx.doc).get(copyId)?.toString()).toContain('Hello doc');
	});

	it('reorders within a layer: frames never jump above other elements', () => {
		const ctx = setup(
			{ ...samples.shape('a', 'a1'), x: 0, y: 0 },
			{ ...samples.shape('b', 'a2'), x: 20, y: 20 },
			{ ...samples.frame('f', 'a0'), x: 0, y: 0, w: 500, h: 500 }
		);
		ctx.selection.set(['a', 'f']);
		reorderSelection(ctx, 'front');
		expect(ctx.store.order).toEqual(['b', 'a']);
		expect(ctx.store.frameOrder).toEqual(['f']);
		reorderSelection(ctx, 'back');
		expect(ctx.store.order).toEqual(['a', 'b']);
	});

	it('toggles lock: locks all if any is unlocked, otherwise unlocks all', () => {
		const ctx = setup(samples.shape('a'), { ...samples.sticky('b'), locked: true });
		ctx.selection.set(['a', 'b']);
		toggleLock(ctx);
		expect([ctx.store.get('a')!.locked, ctx.store.get('b')!.locked]).toEqual([true, true]);
		toggleLock(ctx);
		expect([ctx.store.get('a')!.locked, ctx.store.get('b')!.locked]).toEqual([false, false]);
	});

	it('groups two or more elements and ungroups them', () => {
		const ctx = setup(samples.shape('a'), samples.sticky('b'), {
			...samples.text('c'),
			groupId: 'old'
		});
		ctx.selection.set(['a']);
		groupSelection(ctx);
		expect(ctx.store.get('a')!.groupId).toBeNull();

		ctx.selection.set(['a', 'b', 'c']);
		groupSelection(ctx);
		const g = ctx.store.get('a')!.groupId;
		expect(g).not.toBeNull();
		expect(ctx.store.get('b')!.groupId).toBe(g);
		expect(ctx.store.get('c')!.groupId).toBe(g); // regrouped

		ungroupSelection(ctx);
		expect(['a', 'b', 'c'].map((id) => ctx.store.get(id)!.groupId)).toEqual([null, null, null]);
	});
});
