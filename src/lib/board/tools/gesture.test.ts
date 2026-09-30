import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { getElementsMap } from '$lib/model/doc';
import { createElements, updateElement } from '$lib/model/ops';
import { LOCAL } from '$lib/model/origins';
import { samples } from '$lib/model/testFixtures';
import { undoGesture } from './gesture';

afterEach(() => vi.useRealTimers());

function setup() {
	const doc = new Y.Doc();
	const undo = new Y.UndoManager(getElementsMap(doc), {
		trackedOrigins: new Set([LOCAL]),
		captureTimeout: 500
	});
	return { doc, undo };
}

describe('undoGesture', () => {
	it('keeps a long gesture as one undo step', () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		const { doc, undo } = setup();
		const g = undoGesture(undo);
		g.begin();
		createElements(doc, [samples.shape('a')]);
		vi.advanceTimersByTime(2000); // a pause longer than captureTimeout
		updateElement(doc, 'a', { w: 300 });
		vi.advanceTimersByTime(2000);
		updateElement(doc, 'a', { h: 200 });
		g.end();
		expect(undo.undoStack).toHaveLength(1);
		expect(undo.captureTimeout).toBe(500);
		undo.undo();
		expect(getElementsMap(doc).size).toBe(0);
	});

	it('separates the gesture from edits before and after it', () => {
		const { doc, undo } = setup();
		createElements(doc, [samples.shape('a')]);
		const g = undoGesture(undo);
		g.begin();
		updateElement(doc, 'a', { x: 1 });
		g.end();
		updateElement(doc, 'a', { x: 2 });
		expect(undo.undoStack).toHaveLength(3);
	});

	it('ignores repeated begin/end calls', () => {
		const { undo } = setup();
		const g = undoGesture(undo);
		g.begin();
		g.begin();
		expect(g.active).toBe(true);
		g.end();
		g.end();
		expect(g.active).toBe(false);
		expect(undo.captureTimeout).toBe(500);
	});
});
