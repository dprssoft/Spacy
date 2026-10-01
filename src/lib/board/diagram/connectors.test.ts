import { describe, expect, it } from 'vitest';
import { cloneElements } from '$lib/model/clone';
import { getElementsMap } from '$lib/model/doc';
import { createElements, deleteElements, updateElement } from '$lib/model/ops';
import { samples } from '$lib/model/testFixtures';
import type { ConnectorElement, Element } from '$lib/model/types';
import { testCtx } from '../testCtx';
import { boxConnectable } from './connectable';
import { makeEndpoint, resolveEndpoints } from './endpoints';
import { createConnector, danglingConnectors, newConnector } from './ops';
import { boardWorld } from './world';

// Box A: 0..100 × 0..100 (center 50,50). Box B: 300..400 × 0..100 (center 350,50).
const A = { ...samples.sticky('A', 'a1'), x: 0, y: 0, w: 100, h: 100 };
const B = { ...samples.sticky('B', 'a2'), x: 300, y: 0, w: 100, h: 100 };

function worldOf(...els: Element[]) {
	const map = new Map(els.map((e) => [e.id, e]));
	return boardWorld((id) => map.get(id));
}

describe('resolveEndpoints', () => {
	const world = worldOf(A, B);

	it('resolves ports with outward directions', () => {
		const r = resolveEndpoints(
			{
				from: { kind: 'port', elementId: 'A', port: 'e', lastX: 0, lastY: 0 },
				to: { kind: 'port', elementId: 'B', port: 'w', lastX: 0, lastY: 0 }
			},
			world
		);
		expect(r.start).toEqual({ x: 100, y: 50 });
		expect(r.end).toEqual({ x: 300, y: 50 });
		expect(r.startDir).toEqual({ x: 1, y: 0 });
		expect(r.endDir!.x).toBeCloseTo(-1);
	});

	it('floating ends face each other; free ends stay put', () => {
		const r = resolveEndpoints(
			{
				from: { kind: 'float', elementId: 'A', lastX: 0, lastY: 0 },
				to: { kind: 'float', elementId: 'B', lastX: 0, lastY: 0 }
			},
			world
		);
		expect(r.start.x).toBeCloseTo(100);
		expect(r.end.x).toBeCloseTo(300);
		const f = resolveEndpoints(
			{
				from: { kind: 'free', x: 5, y: 6 },
				to: { kind: 'float', elementId: 'B', lastX: 0, lastY: 0 }
			},
			world
		);
		expect(f.start).toEqual({ x: 5, y: 6 });
		expect(f.end.x).toBeCloseTo(300);
		expect(f.startDir).toBeNull();
	});

	it('fixed anchors follow rotation', () => {
		const rotated = { ...A, rotation: Math.PI / 2 };
		const r = resolveEndpoints(
			{
				from: { kind: 'fixed', elementId: 'A', u: 1, v: 0.5, lastX: 0, lastY: 0 },
				to: { kind: 'free', x: 0, y: 0 }
			},
			worldOf(rotated)
		);
		// The right-middle point rotated 90° around (50,50) is the bottom-middle.
		expect(r.start.x).toBeCloseTo(50);
		expect(r.start.y).toBeCloseTo(100);
	});

	it('falls back to the last known position when the element is missing', () => {
		const r = resolveEndpoints(
			{
				from: { kind: 'port', elementId: 'gone', port: 'e', lastX: 7, lastY: 8 },
				to: { kind: 'free', x: 0, y: 0 }
			},
			worldOf()
		);
		expect(r.start).toEqual({ x: 7, y: 8 });
		expect(r.startDir).toBeNull();
	});
});

describe('makeEndpoint', () => {
	it('picks a port within the radius, otherwise floats; fixed clamps', () => {
		expect(makeEndpoint(A, boxConnectable, { x: 98, y: 52 }, 'auto', 6)).toMatchObject({
			kind: 'port',
			port: 'e'
		});
		expect(makeEndpoint(A, boxConnectable, { x: 30, y: 30 }, 'auto', 6)).toMatchObject({
			kind: 'float'
		});
		expect(makeEndpoint(A, boxConnectable, { x: 150, y: 25 }, 'fixed', 6)).toMatchObject({
			kind: 'fixed',
			u: 1,
			v: 0.25
		});
	});
});

describe('connector document ops', () => {
	it('deleting an attached element frees the end at its position, in one undo step', () => {
		const ctx = testCtx();
		createElements(ctx.doc, [A, B]);
		const id = createConnector(
			ctx.doc,
			{ kind: 'port', elementId: 'A', port: 'e', lastX: 100, lastY: 50 },
			{ kind: 'port', elementId: 'B', port: 'w', lastX: 300, lastY: 50 }
		);
		ctx.undo.stopCapturing();
		deleteElements(ctx.doc, ['B']);
		const c = ctx.store.get(id) as ConnectorElement;
		expect(c.to).toEqual({ kind: 'free', x: 300, y: 50 });
		expect(c.from.kind).toBe('port');
		expect(danglingConnectors(ctx.store.elements.values())).toEqual([id]);
		ctx.history.undo();
		expect((ctx.store.get(id) as ConnectorElement).to.kind).toBe('port');
		expect(ctx.store.get('B')).toBeDefined();
	});

	it('copies remap ends to copied elements and free the others', () => {
		testCtx(); // installs the hooks
		const c = {
			...newConnector(
				{ kind: 'port', elementId: 'A', port: 'e', lastX: 100, lastY: 50 },
				{ kind: 'port', elementId: 'B', port: 'w', lastX: 300, lastY: 50 }
			),
			z: 'a3'
		} as ConnectorElement;
		const { elements, idMap } = cloneElements([A, c], { offset: { x: 10, y: 20 } });
		const copy = elements.find((e) => e.type === 'connector') as ConnectorElement;
		expect(copy.from).toMatchObject({
			kind: 'port',
			elementId: idMap.get('A'),
			lastX: 110,
			lastY: 70
		});
		expect(copy.to).toEqual({ kind: 'free', x: 310, y: 70 });
	});

	it('moving an attached element updates the connector bounds without writing to it', () => {
		const ctx = testCtx();
		createElements(ctx.doc, [A, B]);
		const id = createConnector(
			ctx.doc,
			{ kind: 'port', elementId: 'A', port: 'e', lastX: 100, lastY: 50 },
			{ kind: 'port', elementId: 'B', port: 'w', lastX: 300, lastY: 50 }
		);
		const before = ctx.store.index.get(id)!;
		const connectorMap = getElementsMap(ctx.doc).get(id)!;
		let writes = 0;
		connectorMap.observe(() => writes++);
		updateElement(ctx.doc, 'B', { x: 600 });
		expect(writes).toBe(0);
		expect(ctx.store.index.get(id)!.w).toBeGreaterThan(before.w);
		expect(ctx.store.connectorsOf('B')).toEqual([id]);
	});
});
