import * as Y from 'yjs';
import { cloneHooks } from './clone';
import { getElementsMap } from './doc';
import { beforeDeleteHooks, updateElements } from './ops';
import { LOCAL, WIDGET, type Origin } from './origins';

// Widgets (schema version 8). The element holds `config` (what the user set up; LOCAL, undoable)
// and `state` (what happens while it runs; WIDGET, not undoable). Input many people add at the
// same time goes to `doc.getMap('widgets')`, one plain JSON value per participant under the key
// `<widgetId>:<participantId>`. A flat map, so two peers adding the first entry of a widget at the
// same time never replace each other's (a nested map created on both sides would). Only these
// helpers write either.

export const getWidgetsMap = (doc: Y.Doc): Y.Map<unknown> => doc.getMap('widgets');

const entryKey = (id: string, participant: string) => `${id}:${participant}`;

const isWidget = (doc: Y.Doc, id: string) => getElementsMap(doc).get(id)?.get('type') === 'widget';

export function setWidgetConfig(doc: Y.Doc, id: string, config: unknown, origin: Origin = LOCAL) {
	if (isWidget(doc, id)) updateElements(doc, [{ id, patch: { config } }], origin);
}

export function setWidgetState(doc: Y.Doc, id: string, state: unknown, origin: Origin = WIDGET) {
	if (isWidget(doc, id)) updateElements(doc, [{ id, patch: { state } }], origin);
}

/** One participant's entry (null removes it). */
export function setWidgetEntry(
	doc: Y.Doc,
	id: string,
	participant: string,
	value: unknown,
	origin: Origin = WIDGET
): void {
	if (!isWidget(doc, id)) return;
	doc.transact(() => {
		const key = entryKey(id, participant);
		if (value === null) getWidgetsMap(doc).delete(key);
		else getWidgetsMap(doc).set(key, structuredClone(value));
	}, origin);
}

export function clearWidgetEntries(doc: Y.Doc, id: string, origin: Origin = WIDGET): void {
	doc.transact(() => deleteWidgetEntries(doc, [id]), origin);
}

/** A widget's entries by participant id. */
export function readWidgetEntries(doc: Y.Doc, id: string): Map<string, unknown> {
	const prefix = `${id}:`;
	const out = new Map<string, unknown>();
	for (const [key, value] of getWidgetsMap(doc))
		if (key.startsWith(prefix)) out.set(key.slice(prefix.length), value);
	return out;
}

/** Removes the entries of deleted widgets (any ids: only widgets have entries). */
export function deleteWidgetEntries(doc: Y.Doc, ids: Iterable<string>): void {
	const all = getWidgetsMap(doc);
	if (all.size === 0) return;
	const gone = new Set(ids);
	for (const key of [...all.keys()]) {
		const id = key.slice(0, key.indexOf(':'));
		if (gone.has(id)) all.delete(key);
	}
}

beforeDeleteHooks.push((doc, ids) => deleteWidgetEntries(doc, ids));
// A copy starts fresh: not running, no result (it reads as the kind's default state).
cloneHooks.push((el) => (el.type === 'widget' ? { ...el, state: null } : el));
