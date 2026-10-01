import * as Y from 'yjs';
import type { DocMark, DocNode } from './markdown';

/**
 * A doc card fragment as editor JSON, read straight from Yjs (no editor, no TipTap): elements are
 * nodes with their attributes, text runs carry their formatting as marks.
 */
export function fragmentToJSON(fragment: Y.XmlFragment): DocNode {
	return { type: 'doc', content: children(fragment) };
}

function children(parent: Y.XmlFragment | Y.XmlElement): DocNode[] {
	const out: DocNode[] = [];
	for (const child of parent.toArray()) {
		if (child instanceof Y.XmlText) out.push(...textNodes(child));
		else if (child instanceof Y.XmlElement) out.push(element(child));
	}
	return out;
}

function element(el: Y.XmlElement): DocNode {
	const node: DocNode = { type: el.nodeName };
	const attrs = el.getAttributes() as Record<string, unknown>;
	if (Object.keys(attrs).length > 0) node.attrs = attrs;
	const content = children(el);
	if (content.length > 0) node.content = content;
	return node;
}

function textNodes(text: Y.XmlText): DocNode[] {
	const out: DocNode[] = [];
	for (const op of text.toDelta() as { insert?: unknown; attributes?: Record<string, unknown> }[]) {
		if (typeof op.insert !== 'string' || op.insert === '') continue;
		const node: DocNode = { type: 'text', text: op.insert };
		const marks: DocMark[] = Object.entries(op.attributes ?? {}).map(([type, value]) => {
			const attrs = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
			return Object.keys(attrs).length > 0 ? { type, attrs } : { type };
		});
		if (marks.length > 0) node.marks = marks;
		out.push(node);
	}
	return out;
}
