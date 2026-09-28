import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { getElement, getElementsMap, listElements, maxZ, minZ, readElement, toYMap } from './doc';
import { allSamples, samples } from './testFixtures';

function docWith(...els: ReturnType<typeof allSamples>) {
	const doc = new Y.Doc();
	const map = getElementsMap(doc);
	for (const el of els) map.set(el.id, toYMap(el));
	return doc;
}

describe('doc accessors', () => {
	it.each(allSamples().map((el) => [el.type, el] as const))(
		'round-trips a %s through a Y.Map',
		(_type, el) => {
			const doc = docWith(el);
			const ymap = getElementsMap(doc).get(el.id);
			expect(ymap).toBeDefined();
			expect(readElement(ymap!)).toEqual(el);
		}
	);

	it('stores one key per top-level field with plain JSON nested values', () => {
		const el = samples.connector();
		const ymap = getElementsMap(docWith(el)).get(el.id)!;
		expect([...ymap.keys()].sort()).toEqual(Object.keys(el).sort());
		expect(ymap.get('from')).toEqual(el.from);
		expect(ymap.get('from')).not.toBeInstanceOf(Y.AbstractType);
	});

	it('does not share nested objects with the input', () => {
		const el = samples.shape();
		const doc = docWith(el);
		el.style.fill = '#000000';
		expect(getElement(doc, el.id)?.style.fill).toBe('#ffffff');
	});

	it('lists valid elements sorted by z and skips invalid ones', () => {
		const doc = docWith(samples.sticky('b', 'a5'), samples.shape('a', 'a1'));
		getElementsMap(doc).set('broken', new Y.Map([['type', 'shape']]));
		expect(listElements(doc).map((e) => e.id)).toEqual(['a', 'b']);
		expect(getElement(doc, 'broken')).toBeNull();
		expect(getElement(doc, 'missing')).toBeNull();
	});

	it('finds the min and max z', () => {
		expect(maxZ(new Y.Doc())).toBeNull();
		const doc = docWith(
			samples.shape('a', 'a3'),
			samples.shape('b', 'a1'),
			samples.shape('c', 'a2')
		);
		expect(maxZ(doc)).toBe('a3');
		expect(minZ(doc)).toBe('a1');
	});
});
