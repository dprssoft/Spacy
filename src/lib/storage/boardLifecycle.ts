import { deleteBoardData, writeTitle } from './boardDoc';
import * as boardsRepo from './boardsRepo';

// Whole-board deletion lives here (not in boardsRepo) because boardDoc imports boardsRepo.
// UI code deletes boards only through these functions.

/** Permanently deletes a board: content, metadata and assets. */
export async function destroyBoard(id: string): Promise<void> {
	await deleteBoardData(id);
	await boardsRepo.destroy(id);
}

/** Renames a board in the list and in its content (which is what syncs to other devices). */
export async function renameBoard(id: string, title: string): Promise<void> {
	const t = title.trim();
	if (!t) return;
	await boardsRepo.rename(id, t);
	await writeTitle(id, t);
}

/** Permanently deletes boards that have been in the trash longer than `days`. */
export async function purgeExpiredTrash(now = Date.now(), days = 30): Promise<string[]> {
	const ids = await boardsRepo.expiredTrash(now, days);
	for (const id of ids) await destroyBoard(id);
	return ids;
}
