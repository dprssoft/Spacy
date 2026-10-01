import * as Y from 'yjs';
import { getMeta } from '$lib/model/doc';
import { migrate } from '$lib/model/migrations';
import { TEMPLATE } from '$lib/model/origins';
import { writeSnapshot } from '$lib/storage/boardDoc';
import * as boardsRepo from '$lib/storage/boardsRepo';
import type { BoardMeta } from '$lib/storage/types';
import type { Template } from './index';

/** A new board filled from a template, with its start-page thumbnail ready. */
export async function createBoardFromTemplate(t: Template): Promise<BoardMeta> {
	const doc = new Y.Doc();
	migrate(doc);
	await t.build(doc);
	const meta = await boardsRepo.create({ title: t.name });
	doc.transact(() => getMeta(doc).set('title', meta.title), TEMPLATE);
	await writeSnapshot(meta.id, Y.encodeStateAsUpdate(doc));
	try {
		const { thumbnailForDoc } = await import('./preview');
		const thumb = await thumbnailForDoc(doc);
		if (thumb) await boardsRepo.setThumbnail(meta.id, thumb);
	} catch (err) {
		console.error('Template thumbnail failed', err);
	}
	doc.destroy();
	return meta;
}
