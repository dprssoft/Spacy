import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { createBoardUndo } from '$lib/storage/boardDoc';
import { cloneElements } from './clone';
import { getElement } from './doc';
import { migrate, SCHEMA_VERSION } from './migrations';
import { createElements, deleteElements } from './ops';
import { IMPORT, LOCAL } from './origins';
import { addPage, deletePage } from './pages';
import { parseElement } from './schema';
import { samples } from './testFixtures';
import type { WidgetElement } from './types';
import {
	getWidgetsMap,
	readWidgetEntries,
	setWidgetConfig,
	setWidgetEntry,
	setWidgetState
} from './widgets';

const widget = (doc: Y.Doc, id = 'w1') => getElement(doc, id) as WidgetElement;

function setup() {
	const doc = new Y.Doc();
	const undo = createBoardUndo(doc);
	createElements(doc, [samples.widget('w1')]);
	undo.stopCapturing();
	return { doc, undo };
}

describe('widget elements', () => {
	it('keeps a kind this app does not know, with its data, untouched', () => {
		const el = { ...samples.widget(), kind: 'hologram', config: { beams: 3 }, state: [1, 2] };
		expect(parseElement(el)).toEqual(el);
	});

	it('requires config and state to be present', () => {
		const { config: _c, ...noConfig } = samples.widget();
		expect(parseElement(noConfig)).toBeNull();
		expect(parseElement({ ...samples.widget(), kind: '' })).toBeNull();
		expect(parseElement({ ...samples.widget(), title: 'x'.repeat(101) })).toBeNull();
	});

	it('migrates a v7 doc to version 8 without moving data', () => {
		const doc = new Y.Doc();
		doc.transact(() => doc.getMap('meta').set('schemaVersion', 7), IMPORT);
		migrate(doc);
		expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(8);
		expect(doc.getMap('meta').get('schemaVersion')).toBe(SCHEMA_VERSION);
	});
});

describe('widget writes', () => {
	it('state changes are not undoable; config changes are', () => {
		const { doc, undo } = setup();
		setWidgetConfig(doc, 'w1', { mode: 'countdown', duration: 60, sound: false });
		undo.stopCapturing();
		setWidgetState(doc, 'w1', { startedAt: 1000, elapsed: 0 });
		undo.undo();
		expect(widget(doc).config).toEqual({ mode: 'countdown', duration: 300, sound: true });
		expect(widget(doc).state).toEqual({ startedAt: 1000, elapsed: 0 });
		expect(undo.canUndo()).toBe(true); // the creation is still there to undo
	});

	it('ignores ids that are not widgets', () => {
		const { doc } = setup();
		createElements(doc, [samples.sticky('s1')]);
		setWidgetState(doc, 's1', { x: 1 });
		setWidgetEntry(doc, 's1', 'p1', { v: 1 });
		expect(getElement(doc, 's1')).not.toHaveProperty('state');
		expect(getWidgetsMap(doc).size).toBe(0);
	});

	it('keeps one entry per participant, so concurrent input merges', () => {
		const a = new Y.Doc();
		const b = new Y.Doc();
		createElements(a, [samples.widget('w1')]);
		Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
		setWidgetEntry(a, 'w1', 'pa', { votes: 1 });
		setWidgetEntry(b, 'w1', 'pb', { votes: 2 });
		Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
		Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
		const expected = new Map([
			['pa', { votes: 1 }],
			['pb', { votes: 2 }]
		]);
		expect(readWidgetEntries(a, 'w1')).toEqual(expected);
		expect(readWidgetEntries(b, 'w1')).toEqual(expected);
	});

	it('deleting a widget removes its entries in the same step; undo brings them back', () => {
		const { doc, undo } = setup();
		setWidgetEntry(doc, 'w1', 'p1', { votes: 2 });
		createElements(doc, [samples.widget('w10')]);
		setWidgetEntry(doc, 'w10', 'p1', { votes: 5 });
		undo.stopCapturing();
		deleteElements(doc, ['w1'], LOCAL);
		expect(readWidgetEntries(doc, 'w1').size).toBe(0);
		expect(readWidgetEntries(doc, 'w10').size).toBe(1); // ids sharing a prefix are kept
		undo.undo();
		expect(widget(doc)).toBeTruthy();
		expect(readWidgetEntries(doc, 'w10').size).toBe(1);
		expect(readWidgetEntries(doc, 'w1').get('p1')).toEqual({ votes: 2 });
	});

	it('deleting a page removes the entries of its widgets', () => {
		const doc = new Y.Doc();
		const page = addPage(doc, { name: 'Two' });
		const map = doc.getMap<Y.Map<unknown>>(`page:${page.id}`);
		map.set('w2', new Y.Map(Object.entries(samples.widget('w2'))));
		// setWidgetEntry works on the active page; this widget is on another one.
		getWidgetsMap(doc).set('w2:p1', 1);
		expect(deletePage(doc, page.id)).toBe(true);
		expect(getWidgetsMap(doc).size).toBe(0);
	});

	it('copies start fresh: no state', () => {
		const { elements } = cloneElements([samples.widget('w1')], { offset: { x: 10, y: 0 } });
		const copy = elements[0] as WidgetElement;
		expect(copy.state).toBeNull();
		expect(copy.config).toEqual(samples.widget().config);
		expect(parseElement({ ...copy, z: 'a0' })).not.toBeNull();
	});
});
