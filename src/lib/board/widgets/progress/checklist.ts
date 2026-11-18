import type { DocNode } from '../../doccards/markdown';
import type { TaskCount } from '../kinds';

// Task items anywhere in a doc card (nested lists and tables too). Read from the card's stored
// content as editor JSON, so it works without an editor and for peers' changes alike.

const checked = (v: unknown) => v === true || v === 'true';

/** Done and total task items, or null when there are none. */
export function countTasks(doc: DocNode | null | undefined): TaskCount | null {
	if (!doc) return null;
	let done = 0;
	let total = 0;
	const walk = (node: DocNode) => {
		if (node.type === 'taskItem') {
			total++;
			if (checked(node.attrs?.checked)) done++;
		}
		for (const child of node.content ?? []) walk(child);
	};
	walk(doc);
	return total === 0 ? null : { done, total };
}
