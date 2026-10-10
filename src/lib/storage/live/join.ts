// Opening a share link: the board joins this browser's list under the sharer's id, and its first
// content comes from someone who has it open, before the board opens here. Opening an empty board
// would create structures (the outline map) that compete with the real ones when the two merge.
import * as Y from 'yjs';
import { getMeta } from '$lib/model/doc';
import type { ShareInfo } from '$lib/model/share';
import { loadSnapshot, writeMeta, writeSnapshot } from '../boardDoc';
import * as boardsRepo from '../boardsRepo';
import { PeerSync } from './peerSync';
import { joinLiveRoom } from './room';

const hasContent = (update: Uint8Array) => {
	const doc = new Y.Doc();
	Y.applyUpdate(doc, update);
	const v = typeof getMeta(doc).get('schemaVersion') === 'number';
	doc.destroy();
	return v;
};

/**
 * Makes the board from a share link openable here. Waits (until `signal` aborts) for a peer when
 * this browser has none of its content yet.
 */
export async function joinShared(
	id: string,
	share: ShareInfo,
	signal?: AbortSignal
): Promise<void> {
	const meta = await boardsRepo.get(id);
	if (!meta) {
		await boardsRepo.insert(id, {
			title: boardsRepo.SYNCING_TITLE,
			createdAt: Date.now(),
			starred: false,
			deletedAt: null
		});
	} else if (meta.deletedAt !== null) {
		await boardsRepo.restore(id);
	}
	if (!hasContent(await loadSnapshot(id))) await writeSnapshot(id, await fetchFirst(share, signal));
	await writeMeta(id, 'share', share);
}

async function fetchFirst(share: ShareInfo, signal?: AbortSignal): Promise<Uint8Array> {
	const doc = new Y.Doc();
	const sync = new PeerSync(doc, await joinLiveRoom(share.room, share.key));
	try {
		await new Promise<void>((resolve, reject) => {
			const check = () => {
				if (typeof getMeta(doc).get('schemaVersion') !== 'number') return;
				doc.off('update', check);
				resolve();
			};
			doc.on('update', check);
			signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
		});
		return Y.encodeStateAsUpdate(doc);
	} finally {
		await sync.destroy();
		doc.destroy();
	}
}
