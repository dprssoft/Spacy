import * as Y from 'yjs';
import type { DocNode } from './markdown';

/**
 * Writes editor JSON into a doc card fragment with plain Yjs, the inverse of `fragmentToJSON`.
 * It stores what y-prosemirror would (elements named by node type, text runs with their marks as
 * attributes), without loading TipTap. The JSON must already be valid for the doc card schema
 * (authored content such as templates): unlike the editor, nothing is checked or normalized, and
 * attributes left out take their defaults when the editor opens the card.
 */
export function writeDocJSON(fragment: Y.XmlFragment, json: DocNode): void {
	fragment.delete(0, fragment.length);
	fragment.insert(0, children(json.content ?? []));
}

type Run = { insert: string; attributes: Record<string, unknown> };

function children(nodes: readonly DocNode[]): (Y.XmlElement | Y.XmlText)[] {
	const out: (Y.XmlElement | Y.XmlText)[] = [];
	// Adjacent text nodes share one Y.XmlText, as y-prosemirror stores them. They're written as one
	// delta: a Y.XmlText not yet in a document reports length 0, so appending by index would reverse.
	let runs: Run[] = [];
	const flush = () => {
		if (runs.length === 0) return;
		const text = new Y.XmlText();
		text.applyDelta(runs);
		out.push(text);
		runs = [];
	};
	for (const node of nodes) {
		if (node.type === 'text') {
			if (node.text) runs.push({ insert: node.text, attributes: marks(node) });
			continue;
		}
		flush();
		out.push(element(node));
	}
	flush();
	return out;
}

function element(node: DocNode): Y.XmlElement {
	const el = new Y.XmlElement(node.type ?? 'paragraph');
	for (const [key, value] of Object.entries(node.attrs ?? {}))
		if (value !== null && value !== undefined) el.setAttribute(key, value as string);
	el.insert(0, children(node.content ?? []));
	return el;
}

function marks(node: DocNode): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const m of node.marks ?? []) out[m.type] = m.attrs ?? {};
	return out;
}
