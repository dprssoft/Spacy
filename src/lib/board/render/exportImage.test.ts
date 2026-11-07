import { describe, expect, it } from 'vitest';
import { createElements } from '$lib/model/ops';
import { samples } from '$lib/model/testFixtures';
import type { ConnectorElement, Element } from '$lib/model/types';
import { testCtx } from '../testCtx';
import { rasterExtension, scopeElements } from './exportImage';

function setup() {
	const ctx = testCtx();
	const frame = { ...samples.frame('f', 'a0'), x: 0, y: 0, w: 500, h: 400 };
	const a = { ...samples.shape('a', 'a1'), x: 20, y: 20, parentId: 'f' };
	const b = { ...samples.shape('b', 'a2'), x: 200, y: 20, parentId: 'f' };
	const out = { ...samples.shape('out', 'a3'), x: 900, y: 20 };
	const conn = (id: string, from: string, to: string, z: string): ConnectorElement => ({
		...samples.connector(id, z),
		from: { kind: 'port', elementId: from, port: 'e', lastX: 0, lastY: 0 },
		to: { kind: 'port', elementId: to, port: 'w', lastX: 0, lastY: 0 }
	});
	const els: Element[] = [
		frame,
		a,
		b,
		out,
		conn('ab', 'a', 'b', 'a4'),
		conn('ao', 'a', 'out', 'a5')
	];
	createElements(ctx.doc, els);
	return ctx;
}

const ids = (els: Element[]) => els.map((e) => e.id);

describe('rasterExtension', () => {
	it('names the file after what the browser really wrote', () => {
		const of = (type: string) => rasterExtension(new Blob([], { type }));
		expect(of('image/jpeg')).toBe('jpg');
		expect(of('image/webp')).toBe('webp');
		expect(of('image/png')).toBe('png');
	});
});

describe('scopeElements', () => {
	it('board: everything, frames first then by z', () => {
		expect(ids(scopeElements(setup(), { kind: 'board' }))).toEqual([
			'f',
			'a',
			'b',
			'out',
			'ab',
			'ao'
		]);
	});

	it('frame: the frame, its children and connectors with both ends inside', () => {
		expect(ids(scopeElements(setup(), { kind: 'frame', id: 'f' }))).toEqual(['f', 'a', 'b', 'ab']);
	});

	it('selection: selected elements plus connectors between them', () => {
		const ctx = setup();
		ctx.selection.set(['a', 'out']);
		expect(ids(scopeElements(ctx, { kind: 'selection' }))).toEqual(['a', 'out', 'ao']);
	});
});
