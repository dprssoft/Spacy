import { describe, expect, it } from 'vitest';
import { createElements } from '$lib/model/ops';
import { samples } from '$lib/model/testFixtures';
import type { ConnectorElement, Element } from '$lib/model/types';
import { testCtx } from '../testCtx';
import { createConnector } from './ops';
import { connectedComponent, quickCreate, quickPlacement } from './quickCreate';

const src = { x: 0, y: 0, w: 160, h: 100 };
const size = { w: 160, h: 100 };

describe('quickPlacement', () => {
	it('places the new box 80px away, centered on the source axis', () => {
		const none = () => false;
		expect(quickPlacement(src, size, 'e', none)).toEqual({ x: 240, y: 0, w: 160, h: 100 });
		expect(quickPlacement(src, size, 'w', none)).toEqual({ x: -240, y: 0, w: 160, h: 100 });
		expect(quickPlacement(src, size, 's', none)).toEqual({ x: 0, y: 180, w: 160, h: 100 });
		expect(quickPlacement(src, { w: 40, h: 20 }, 'n', none)).toEqual({
			x: 60,
			y: -100,
			w: 40,
			h: 20
		});
	});

	it('shifts sideways while the spot is taken', () => {
		let calls = 0;
		const firstTaken = () => calls++ === 0;
		expect(quickPlacement(src, size, 'e', firstTaken).y).toBe(140);
		expect(quickPlacement(src, size, 's', () => true).x).toBe(5 * 200); // gives up after 5 tries
	});
});

describe('quickCreate', () => {
	const setup = (el: Element) => {
		const ctx = testCtx();
		createElements(ctx.doc, [{ ...el, x: 0, y: 0, w: 160, h: 100 }]);
		ctx.undo.stopCapturing();
		return ctx;
	};

	it('creates a same-kind neighbour connected port to port, as one undo step', () => {
		const ctx = setup({ ...samples.shape('a'), kind: 'diamond' });
		const id = quickCreate(ctx, 'a', 'e')!;
		const el = ctx.store.get(id)!;
		expect(el).toMatchObject({ type: 'shape', kind: 'diamond', x: 240, y: 0, w: 160, h: 100 });
		const conn = [...ctx.store.elements.values()].find(
			(e) => e.type === 'connector'
		) as ConnectorElement;
		expect(conn.from).toMatchObject({ kind: 'port', elementId: 'a', port: 'e' });
		expect(conn.to).toMatchObject({ kind: 'port', elementId: id, port: 'w' });
		ctx.history.undo();
		expect(ctx.store.elements.size).toBe(1);
	});

	it('maps types: sticky keeps its color, image becomes a sticky, stroke a rectangle', () => {
		const sticky = setup({ ...samples.sticky('s'), color: '#a5d8ff' });
		const s = sticky.store.get(quickCreate(sticky, 's', 's')!)!;
		expect(s).toMatchObject({ type: 'sticky', color: '#a5d8ff' });

		const image = setup(samples.image('i'));
		expect(image.store.get(quickCreate(image, 'i', 'e')!)!.type).toBe('sticky');

		const stroke = setup(samples.stroke('p'));
		expect(stroke.store.get(quickCreate(stroke, 'p', 'e')!)).toMatchObject({
			type: 'shape',
			kind: 'rect'
		});
	});

	it('honours an explicit type choice', () => {
		const ctx = setup(samples.shape('a'));
		const el = ctx.store.get(quickCreate(ctx, 'a', 'e', { type: 'text' })!)!;
		expect(el.type).toBe('text');
	});

	it('avoids overlapping existing elements', () => {
		const ctx = setup(samples.shape('a'));
		createElements(ctx.doc, [{ ...samples.sticky('blocker'), x: 240, y: 0, w: 160, h: 100 }]);
		const el = ctx.store.get(quickCreate(ctx, 'a', 'e')!)!;
		expect(el.y).toBe(140);
	});
});

describe('connectedComponent', () => {
	it('walks connectors in both directions and ignores unconnected elements', () => {
		const ctx = testCtx();
		createElements(ctx.doc, [
			samples.shape('a'),
			samples.shape('b'),
			samples.shape('c'),
			samples.shape('lonely')
		]);
		const p = (id: string) => ({ kind: 'float' as const, elementId: id, lastX: 0, lastY: 0 });
		const ab = createConnector(ctx.doc, p('a'), p('b'));
		const cb = createConnector(ctx.doc, p('c'), p('b'));
		expect(connectedComponent(ctx, ['a']).sort()).toEqual(['a', 'b', 'c', ab, cb].sort());
		expect(connectedComponent(ctx, ['lonely'])).toEqual(['lonely']);
	});
});
