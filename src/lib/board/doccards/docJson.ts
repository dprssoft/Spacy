import { getDocsMap } from '$lib/model/doc';
import type { BoardContext } from '../context';
import { fragmentToJSON } from './fragmentJson';
import type { DocNode } from './markdown';

/** A doc card's content as editor JSON, read from its Yjs fragment (always current, no editor). */
export function getDocJSON(ctx: BoardContext, id: string): DocNode {
	const fragment = getDocsMap(ctx.doc).get(id);
	return fragment ? fragmentToJSON(fragment) : { type: 'doc', content: [] };
}
