import { newId } from '$lib/model/ids';
import { getDB } from './db';
import { fromStored, toBytes, writeWithFallback } from './storedBlob';
import type { AssetRecord, StoredAssetRecord } from './types';

const fromRecord = (r: StoredAssetRecord): AssetRecord => ({ ...r, blob: fromStored(r.blob) });
const asBytes = async (r: StoredAssetRecord): Promise<StoredAssetRecord> => ({
	...r,
	blob: r.blob instanceof Blob ? await toBytes(r.blob) : r.blob
});

export async function put(
	boardId: string,
	blob: Blob,
	dims: { width: number; height: number }
): Promise<string> {
	const record: AssetRecord = {
		id: newId(),
		boardId,
		blob,
		mime: blob.type || 'application/octet-stream',
		width: dims.width,
		height: dims.height,
		createdAt: Date.now()
	};
	const db = await getDB();
	await writeWithFallback<StoredAssetRecord, string>(record, asBytes, (r) => db.add('assets', r));
	return record.id;
}

/** Stores an image that came from another device, keeping its id. */
export async function putSynced(record: Omit<AssetRecord, 'createdAt'>): Promise<void> {
	const db = await getDB();
	await writeWithFallback<StoredAssetRecord, string>(
		{ ...record, createdAt: Date.now() },
		asBytes,
		(r) => db.put('assets', r)
	);
}

export async function get(id: string): Promise<AssetRecord | undefined> {
	const r = await (await getDB()).get('assets', id);
	return r && fromRecord(r);
}

export async function listByBoard(boardId: string): Promise<AssetRecord[]> {
	return (await (await getDB()).getAllFromIndex('assets', 'boardId', boardId)).map(fromRecord);
}

export async function deleteByBoard(boardId: string): Promise<void> {
	const tx = (await getDB()).transaction('assets', 'readwrite');
	const keys = await tx.store.index('boardId').getAllKeys(boardId);
	await Promise.all(keys.map((k) => tx.store.delete(k)));
	await tx.done;
}

export async function deleteMany(ids: readonly string[]): Promise<void> {
	const tx = (await getDB()).transaction('assets', 'readwrite');
	await Promise.all(ids.map((id) => tx.store.delete(id)));
	await tx.done;
}

/** Copies all of a board's assets to another board. Returns old id → new id. */
export async function copyToBoard(
	fromBoardId: string,
	toBoardId: string
): Promise<Map<string, string>> {
	const tx = (await getDB()).transaction('assets', 'readwrite');
	const records = await tx.store.index('boardId').getAll(fromBoardId);
	const idMap = new Map<string, string>();
	const now = Date.now();
	await Promise.all(
		records.map((r) => {
			const id = newId();
			idMap.set(r.id, id);
			return tx.store.add({ ...r, id, boardId: toBoardId, createdAt: now });
		})
	);
	await tx.done;
	return idMap;
}
