import { getDocsMap } from '$lib/model/doc';
import type { BoardContext } from '../context';
import { createDocEditor } from './editorFactory';
import { liveEditor } from './editorRegistry';
import type { DocNode } from './markdown';

/**
 * A doc card's content as editor JSON: from a live editor if one is mounted, otherwise from a
 * short-lived headless editor on the card's fragment. Async so the editor can be lazy-loaded later.
 */
export async function getDocJSON(ctx: BoardContext, id: string): Promise<DocNode> {
	return getDocJSONSync(ctx, id);
}

/** Synchronous variant, for callers that must finish reading before the board closes. */
export function getDocJSONSync(ctx: BoardContext, id: string): DocNode {
	const live = liveEditor(id);
	if (live) return live.getJSON();
	const fragment = getDocsMap(ctx.doc).get(id);
	if (!fragment) return { type: 'doc', content: [] };
	const editor = createDocEditor({
		element: document.createElement('div'),
		fragment,
		editable: false
	});
	try {
		return editor.getJSON();
	} finally {
		editor.destroy();
	}
}
