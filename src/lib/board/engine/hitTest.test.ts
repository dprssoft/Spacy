import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { createElements } from '$lib/model/ops';
import { samples } from '$lib/model/testFixtures';
import { BoardStore } from '../boardStore.svelte';
import { hitElement, hitElementsInRect } from './hitTest';

// Sample boxes are x 10..110, y 20..70 unless moved.
function setup() {
	const doc = new Y.Doc();
	createElements(doc, [
		{ ...samples.frame('frame', 'Zz'), x: 0, y: 0, w: 400, h: 300 },
		samples.shape('low', 'a1'),
		{ ...samples.sticky('high', 'a2'), x: 60, y: 40 },
		{ ...samples.shape('rotated', 'a3'), x: 200, y: 100, w: 100, h: 20, rotation: Math.PI / 2 }
	]);
	return new BoardStore(doc);
}

describe('hitElement', () => {
	it('returns the topmost element; frames stay beneath others regardless of z', () => {
		const store = setup();
		expect(hitElement(store, { x: 80, y: 60 }, 0)).toBe('high');
		expect(hitElement(store, { x: 20, y: 30 }, 0)).toBe('low');
		expect(hitElement(store, { x: 1000, y: 1000 }, 0)).toBeNull();
	});

	it('hits frames only on their border or title label (step 16)', () => {
		const store = setup();
		expect(hitElement(store, { x: 350, y: 250 }, 0)).toBeNull(); // empty interior
		expect(hitElement(store, { x: 399.5, y: 250 }, 0)).toBe('frame'); // border
		expect(hitElement(store, { x: 20, y: -10 }, 0)).toBe('frame'); // title label
	});

	it('respects rotation', () => {
		const store = setup();
		// Rotated 90° around its center (250, 110): now spans x 240..260, y 60..160.
		expect(hitElement(store, { x: 250, y: 150 }, 0)).toBe('rotated');
		expect(hitElement(store, { x: 290, y: 110 }, 0)).toBeNull(); // frame interior
	});

	it('applies tolerance', () => {
		const store = setup();
		expect(hitElement(store, { x: 5, y: 30 }, 0)).toBeNull();
		expect(hitElement(store, { x: 5, y: 30 }, 6)).toBe('low');
	});
});

describe('hitElementsInRect', () => {
	it('selects touching or fully contained elements', () => {
		const store = setup();
		const rect = { x: 0, y: 0, w: 70, h: 50 };
		expect(hitElementsInRect(store, rect, 'intersect').sort()).toEqual(['frame', 'high', 'low']);
		expect(hitElementsInRect(store, { x: 0, y: 0, w: 120, h: 80 }, 'contain')).toEqual(['low']);
	});
});
