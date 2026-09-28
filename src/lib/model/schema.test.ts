import { describe, expect, it } from 'vitest';
import { parseElement } from './schema';
import { allSamples, samples } from './testFixtures';

describe('parseElement', () => {
	it.each(allSamples().map((el) => [el.type, el] as const))('accepts a valid %s', (_type, el) => {
		expect(parseElement(el)).toEqual(el);
	});

	it('returns a fresh copy, not the input object', () => {
		const el = samples.shape();
		const parsed = parseElement(el);
		expect(parsed).not.toBe(el);
		expect(parsed?.style).not.toBe(el.style);
	});

	it('strips unknown keys', () => {
		expect(parseElement({ ...samples.text(), extra: 1 })).not.toHaveProperty('extra');
	});

	it.each([
		['missing field', () => ({ ...samples.shape(), text: undefined })],
		['wrong enum', () => ({ ...samples.shape(), kind: 'hexagon' })],
		['unknown type', () => ({ ...samples.shape(), type: 'widget' })],
		[
			'bad stroke width',
			() => ({ ...samples.shape(), style: { ...samples.shape().style, strokeWidth: 3 } })
		],
		['NaN coordinate', () => ({ ...samples.sticky(), x: Number.NaN })],
		['negative size', () => ({ ...samples.sticky(), w: -1 })],
		['empty z', () => ({ ...samples.sticky(), z: '' })],
		[
			'opacity out of range',
			() => ({ ...samples.text(), style: { ...samples.text().style, opacity: 0 } })
		],
		[
			'bad endpoint',
			() => ({
				...samples.connector(),
				to: { kind: 'port', elementId: 'x', port: 'up', lastX: 0, lastY: 0 }
			})
		],
		[
			'label t > 1',
			() => ({ ...samples.connector(), label: { text: '', t: 2, background: false } })
		],
		['not an object', () => 'shape']
	])('rejects %s', (_name, make) => {
		expect(parseElement(make())).toBeNull();
	});
});
