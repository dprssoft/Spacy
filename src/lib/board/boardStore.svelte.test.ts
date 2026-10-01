import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { getElementsMap } from '$lib/model/doc';
import { createElements, deleteElements, updateElement } from '$lib/model/ops';
import { REMOTE_TAB } from '$lib/model/origins';
import { samples } from '$lib/model/testFixtures';
import { BoardStore } from './boardStore.svelte';

function setup() {
	const doc = new Y.Doc();
	createElements(doc, [samples.shape('a', 'a1'), samples.frame('f', 'a0')]);
	return { doc, store: new BoardStore(doc) };
}

describe('BoardStore', () => {
	it('loads existing elements, the index and the order', () => {
		const { store } = setup();
		expect(store.get('a')?.type).toBe('shape');
		expect(store.order).toEqual(['a']);
		expect(store.frameOrder).toEqual(['f']);
		expect(store.index.size).toBe(2);
	});

	it('reflects creates, updates and deletes', () => {
		const { doc, store } = setup();
		createElements(doc, [samples.sticky('s', 'a2')]);
		expect(store.get('s')?.type).toBe('sticky');
		expect(store.order).toEqual(['a', 's']);

		updateElement(doc, 's', { x: 500 });
		expect(store.get('s')?.x).toBe(500);
		expect(store.index.get('s')?.x).toBe(500);

		deleteElements(doc, ['s']);
		expect(store.get('s')).toBeUndefined();
		expect(store.order).toEqual(['a']);
		expect(store.index.get('s')).toBeUndefined();
	});

	it('reflects updates from other tabs', () => {
		const { doc, store } = setup();
		const remote = new Y.Doc();
		Y.applyUpdate(remote, Y.encodeStateAsUpdate(doc));
		updateElement(remote, 'a', { text: 'Remote' });
		Y.applyUpdate(doc, Y.encodeStateAsUpdate(remote), REMOTE_TAB);
		const a = store.get('a');
		expect(a?.type === 'shape' ? a.text : null).toBe('Remote');
	});

	it('keeps other snapshots untouched when one element changes', () => {
		const { doc, store } = setup();
		createElements(doc, [samples.sticky('s', 'a2')]);
		const before = store.get('s');
		updateElement(doc, 'a', { x: 1 });
		expect(store.get('s')).toBe(before);
	});

	it('reorders on z changes only', () => {
		const { doc, store } = setup();
		createElements(doc, [samples.sticky('s', 'a2')]);
		const order = store.order;
		updateElement(doc, 'a', { x: 99 });
		expect(store.order).toBe(order);
		updateElement(doc, 'a', { z: 'a3' });
		expect(store.order).toEqual(['s', 'a']);
	});

	it('bumps version per change and computes content bounds', () => {
		const { doc, store } = setup();
		const v = store.version;
		updateElement(doc, 'a', { x: -100 });
		expect(store.version).toBe(v + 1);
		// The frame's bounds include its title label (22px above its box, which starts at y=20).
		expect(store.contentBounds()).toEqual({ x: -100, y: -2, w: 210, h: 72 });
	});

	it('stops listening after destroy', () => {
		const { doc, store } = setup();
		store.destroy();
		updateElement(doc, 'a', { x: 42 });
		expect(store.get('a')?.x).toBe(10);
		expect(getElementsMap(doc).size).toBe(2);
	});
});
