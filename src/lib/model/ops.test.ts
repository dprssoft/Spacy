import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { getDocsMap, getElement, getElementsMap, getMeta, listElements, readElement } from './doc';
import {
	beforeDeleteHooks,
	createElements,
	deleteElements,
	InvalidElementError,
	setMeta,
	updateElement,
	updateElements
} from './ops';
import { IMPORT, LOCAL, type Origin } from './origins';
import { samples } from './testFixtures';
import type { NewElement } from './types';

function withoutZ<T extends { z: string }>(el: T): Omit<T, 'z'> {
	const { z: _z, ...rest } = el;
	return rest;
}

function recordOrigins(doc: Y.Doc): Origin[] {
	const origins: Origin[] = [];
	doc.on('afterTransaction', (tr: Y.Transaction) => origins.push(tr.origin as Origin));
	return origins;
}

afterEach(() => {
	beforeDeleteHooks.length = 0;
});

describe('createElements', () => {
	it('assigns increasing z keys above existing elements, in order', () => {
		const doc = new Y.Doc();
		createElements(doc, [withoutZ(samples.shape('a')) as NewElement]);
		createElements(doc, [
			withoutZ(samples.sticky('b')) as NewElement,
			withoutZ(samples.text('c')) as NewElement
		]);
		const [a, b, c] = ['a', 'b', 'c'].map((id) => getElement(doc, id)!.z);
		expect(a! < b! && b! < c!).toBe(true);
		expect(listElements(doc).map((e) => e.id)).toEqual(['a', 'b', 'c']);
	});

	it('keeps an explicit z', () => {
		const doc = new Y.Doc();
		createElements(doc, [samples.shape('a', 'Zz')]);
		expect(getElement(doc, 'a')?.z).toBe('Zz');
	});

	it('creates a doc fragment for doc cards', () => {
		const doc = new Y.Doc();
		createElements(doc, [samples.doccard('d')]);
		expect(getDocsMap(doc).get('d')).toBeInstanceOf(Y.XmlFragment);
	});

	it('rejects invalid elements and duplicate ids without partial writes', () => {
		const doc = new Y.Doc();
		createElements(doc, [samples.shape('a')]);
		const bad = { ...samples.shape('x'), kind: 'nope' } as unknown as NewElement;
		expect(() => createElements(doc, [bad])).toThrow(InvalidElementError);
		expect(() => createElements(doc, [samples.sticky('a')])).toThrow(/Duplicate/);
		expect(getElementsMap(doc).size).toBe(1);
	});

	it('returns the created elements', () => {
		const created = createElements(new Y.Doc(), [withoutZ(samples.shape('a')) as NewElement]);
		expect(created[0]?.id).toBe('a');
		expect(created[0]?.z).toBeTypeOf('string');
	});
});

describe('updateElement(s)', () => {
	it('writes only keys whose values changed', () => {
		const doc = new Y.Doc();
		createElements(doc, [samples.shape('a')]);
		const ymap = getElementsMap(doc).get('a')!;
		const set = vi.spyOn(ymap, 'set');
		updateElement(doc, 'a', { x: 99, text: 'Box', style: samples.shape().style });
		expect(set.mock.calls.map(([k]) => k)).toEqual(['x']);
		expect(getElement(doc, 'a')?.x).toBe(99);
	});

	it('emits no update for a no-op patch', () => {
		const doc = new Y.Doc();
		createElements(doc, [samples.shape('a')]);
		const onUpdate = vi.fn();
		doc.on('update', onUpdate);
		updateElement(doc, 'a', { text: 'Box' });
		expect(onUpdate).not.toHaveBeenCalled();
	});

	it('replaces nested objects as a whole', () => {
		const doc = new Y.Doc();
		createElements(doc, [samples.shape('a')]);
		const style = { ...samples.shape().style, fill: '#ff0000' };
		updateElement(doc, 'a', { style });
		expect(getElement(doc, 'a')?.style).toEqual(style);
	});

	it('throws on id or type changes and on invalid results', () => {
		const doc = new Y.Doc();
		createElements(doc, [samples.shape('a')]);
		expect(() => updateElement(doc, 'a', { id: 'b' })).toThrow(/id/);
		expect(() => updateElement(doc, 'a', { type: 'sticky' })).toThrow(/type/);
		expect(() => updateElement(doc, 'a', { w: -5 })).toThrow(InvalidElementError);
		expect(getElement(doc, 'a')?.w).toBe(100);
	});

	it('ignores missing ids and applies batches in one transaction', () => {
		const doc = new Y.Doc();
		createElements(doc, [samples.shape('a'), samples.sticky('b')]);
		const origins = recordOrigins(doc);
		updateElements(doc, [
			{ id: 'a', patch: { x: 1 } },
			{ id: 'b', patch: { x: 2 } },
			{ id: 'missing', patch: { x: 3 } }
		]);
		expect(origins).toHaveLength(1);
		expect([getElement(doc, 'a')?.x, getElement(doc, 'b')?.x]).toEqual([1, 2]);
	});

	it('skips an element whose stored data is invalid', () => {
		const doc = new Y.Doc();
		createElements(doc, [samples.shape('a')]);
		doc.transact(() => getElementsMap(doc).get('a')!.set('w', 'broken'));
		expect(() => updateElement(doc, 'a', { x: 5 })).not.toThrow();
		expect(getElementsMap(doc).get('a')!.get('x')).toBe(samples.shape('a').x);
	});

	it('observers read the written element; later reads come from the stored data', () => {
		const doc = new Y.Doc();
		createElements(doc, [samples.shape('a')]);
		const ymap = getElementsMap(doc).get('a')!;
		const seen: unknown[] = [];
		getElementsMap(doc).observeDeep(() => seen.push(readElement(ymap)));
		updateElement(doc, 'a', { x: 7, style: { ...samples.shape('a').style, opacity: 0.5 } });
		expect(seen).toEqual([
			{ ...samples.shape('a'), x: 7, style: { ...samples.shape('a').style, opacity: 0.5 } }
		]);

		// A change that doesn't go through ops (e.g. from another tab) is read from the map.
		doc.transact(() => ymap.set('y', 42), 'remote');
		expect(seen[1]).toMatchObject({ x: 7, y: 42 });
		expect(readElement(ymap)).toMatchObject({ x: 7, y: 42 });
	});

	it('reads stale keys left beside the written fields from the stored data', () => {
		const doc = new Y.Doc();
		createElements(doc, [samples.shape('a')]);
		const ymap = getElementsMap(doc).get('a')!;
		doc.transact(() => ymap.set('legacy', true));
		let seen: unknown = null;
		getElementsMap(doc).observeDeep(() => (seen = readElement(ymap)));
		updateElement(doc, 'a', { x: 3 });
		expect(seen).toEqual({ ...samples.shape('a'), x: 3 });
	});
});

describe('deleteElements', () => {
	it('removes elements and their doc fragments', () => {
		const doc = new Y.Doc();
		createElements(doc, [samples.shape('a'), samples.doccard('d')]);
		deleteElements(doc, ['a', 'd', 'missing']);
		expect(getElementsMap(doc).size).toBe(0);
		expect(getDocsMap(doc).has('d')).toBe(false);
	});

	it('runs hooks inside the transaction, which may extend the set', () => {
		const doc = new Y.Doc();
		createElements(doc, [samples.frame('f'), samples.sticky('child')]);
		const origins = recordOrigins(doc);
		beforeDeleteHooks.push((_doc, ids) => {
			if (ids.has('f')) ids.add('child');
		});
		deleteElements(doc, ['f']);
		expect(getElementsMap(doc).size).toBe(0);
		expect(origins).toHaveLength(1);
	});
});

describe('origins', () => {
	it('tags every op with the given origin (LOCAL by default)', () => {
		const doc = new Y.Doc();
		const origins = recordOrigins(doc);
		createElements(doc, [samples.shape('a')]);
		updateElement(doc, 'a', { x: 5 }, IMPORT);
		deleteElements(doc, ['a']);
		setMeta(doc, 'title', 'Board');
		expect(origins).toEqual([LOCAL, IMPORT, LOCAL, LOCAL]);
		expect(getMeta(doc).get('title')).toBe('Board');
	});
});
