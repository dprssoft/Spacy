import type * as Y from 'yjs';
import { getSketchesMap } from '$lib/model/doc';
import { parseStroke, type SketchStroke } from './brushes';

// Stored stroke objects are immutable once written, so validation is cached by identity (and the
// parsed stroke's identity is stable too, which the canvas uses to cache its paths).
const parsed = new WeakMap<object, SketchStroke | null>();

/** The valid strokes of a sketch, in drawing order. */
export function readStrokes(doc: Y.Doc, sketchId: string): SketchStroke[] {
	const arr = getSketchesMap(doc).get(sketchId);
	if (!arr) return [];
	const out: SketchStroke[] = [];
	for (const raw of arr.toArray()) {
		if (!raw || typeof raw !== 'object') continue;
		let stroke = parsed.get(raw);
		if (stroke === undefined) parsed.set(raw, (stroke = parseStroke(raw)));
		if (stroke) out.push(stroke);
	}
	return out;
}

/** The raw stored strokes (for copying a sketch). */
export function rawStrokes(doc: Y.Doc, sketchId: string): unknown[] {
	return getSketchesMap(doc).get(sketchId)?.toArray() ?? [];
}
