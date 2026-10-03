import type * as Y from 'yjs';
import { getDocsMap } from '$lib/model/doc';
import { TEMPLATE } from '$lib/model/origins';
import type { DocNode } from '$lib/board/doccards/markdown';
import type { TemplateBuilder } from './builder';
import { setDocContent } from './docContent';

// Small builders for doc card content in templates.

export const t = (text: string): DocNode => ({ type: 'text', text });
export const p = (text: string): DocNode => ({ type: 'paragraph', content: text ? [t(text)] : [] });
export const h = (level: number, text: string): DocNode => ({
	type: 'heading',
	attrs: { level },
	content: [t(text)]
});
export const items = (type: string, texts: string[], item = 'listItem'): DocNode => ({
	type,
	content: texts.map((x) => ({
		type: item,
		...(item === 'taskItem' ? { attrs: { checked: false } } : {}),
		content: [p(x)]
	}))
});
export const doc = (...content: DocNode[]): DocNode => ({ type: 'doc', content });

/** Commits the builder and fills doc cards (by element id) in one TEMPLATE transaction. */
export function commitWithDocs(
	b: TemplateBuilder,
	ydoc: Y.Doc,
	contents: Map<string, DocNode>
): void {
	ydoc.transact(() => {
		b.commit(ydoc);
		const docs = getDocsMap(ydoc);
		for (const [id, content] of contents) setDocContent(docs.get(id)!, content);
	}, TEMPLATE);
}
