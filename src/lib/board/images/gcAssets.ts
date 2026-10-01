import type * as Y from 'yjs';
import { listElements } from '$lib/model/doc';
import * as assetsRepo from '$lib/storage/assetsRepo';

/** Assets younger than this are kept: another tab may be about to add the element using them. */
const GRACE_MS = 60_000;

/**
 * Deletes a board's assets that no image element references. Run when a board opens: the undo
 * history is empty then, so nothing can bring a deleted image back. Returns the deleted ids.
 */
export async function gcAssets(boardId: string, doc: Y.Doc, now = Date.now()): Promise<string[]> {
	const used = new Set<string>();
	for (const el of listElements(doc)) if (el.type === 'image') used.add(el.assetId);
	const unused = (await assetsRepo.listByBoard(boardId))
		.filter((a) => !used.has(a.id) && now - a.createdAt > GRACE_MS)
		.map((a) => a.id);
	if (unused.length) await assetsRepo.deleteMany(unused);
	return unused;
}
