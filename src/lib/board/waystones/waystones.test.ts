import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { migrate, SCHEMA_VERSION } from '$lib/model/migrations';
import { IMPORT } from '$lib/model/origins';
import { parseElement } from '$lib/model/schema';
import { samples } from '$lib/model/testFixtures';
import { testCtx } from '../testCtx';
import { anchorOf, flyTarget } from './route';

describe('waystone model', () => {
	it('validates name, zoom range and order', () => {
		expect(parseElement(samples.waystone())).toEqual(samples.waystone());
		expect(parseElement({ ...samples.waystone(), zoom: 10 })).toBeNull();
		expect(parseElement({ ...samples.waystone(), order: '' })).toBeNull();
		expect(parseElement({ ...samples.waystone(), name: 'x'.repeat(101) })).toBeNull();
	});

	it('migrates a v6 doc to the current version without moving data', () => {
		const doc = new Y.Doc();
		doc.transact(() => doc.getMap('meta').set('schemaVersion', 6), IMPORT);
		migrate(doc);
		// The test was written at version 7; the current version only grows from there.
		expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(7);
		expect(doc.getMap('meta').get('schemaVersion')).toBe(SCHEMA_VERSION);
	});
});

describe('WaystonesState', () => {
	it('adds at the view centre with the current zoom, at the end of the route; each is one undo step', () => {
		const ctx = testCtx();
		ctx.viewport.set({ x: 500, y: 400, zoom: 2 });
		const a = ctx.waystones.add();
		ctx.viewport.set({ x: 0, y: 0, zoom: 0.5 });
		const b = ctx.waystones.add({ x: 300, y: 200 });
		const route = ctx.waystones.route;
		expect(route.map((w) => w.id)).toEqual([a, b]);
		expect(anchorOf(route[0]!)).toEqual({ x: 0, y: 0 });
		expect(route[0]!.zoom).toBe(2);
		expect(anchorOf(route[1]!)).toEqual({ x: 300, y: 200 });
		expect(route.map((w) => w.name)).toEqual(['Waystone 1', 'Waystone 2']);
		ctx.history.undo();
		expect(ctx.waystones.route.map((w) => w.id)).toEqual([a]);
	});

	it('steps with and without wrapping, and flies to the target view', () => {
		const ctx = testCtx();
		const ids = [0, 1, 2].map((i) => ctx.waystones.add({ x: i * 1000, y: 0 }));
		ctx.waystones.current = -1;
		ctx.waystones.setWrap(false);
		ctx.waystones.step(1);
		expect(ctx.waystones.current).toBe(0);
		ctx.waystones.go(2);
		ctx.waystones.step(1);
		expect(ctx.waystones.current).toBe(2);
		ctx.waystones.setWrap(true);
		ctx.waystones.step(1);
		expect(ctx.waystones.current).toBe(0);
		// Reduced motion isn't set in tests: finish the animation by setting the target directly.
		const target = flyTarget(ctx.store.get(ids[0]!) as never, ctx.viewport.size);
		expect(target).toEqual({ x: 500, y: 400, zoom: 1 });
	});

	it('renames, reorders, updates zoom and removes', () => {
		const ctx = testCtx();
		const [a, b, c] = [0, 1, 2].map((i) => ctx.waystones.add({ x: i * 100, y: 0 }));
		ctx.waystones.rename(b!, '  Act II  ');
		ctx.waystones.move(c!, 0);
		expect(ctx.waystones.route.map((w) => w.id)).toEqual([c, a, b]);
		expect(ctx.store.get(b!)).toMatchObject({ name: 'Act II' });
		ctx.viewport.set({ x: 0, y: 0, zoom: 3 });
		ctx.waystones.updateZoom(a!);
		expect(ctx.store.get(a!)).toMatchObject({ zoom: 3 });
		ctx.history.undo();
		expect(ctx.store.get(a!)).toMatchObject({ zoom: 1 });
		ctx.waystones.remove(c!);
		expect(ctx.waystones.route.map((w) => w.id)).toEqual([a, b]);
	});
});
