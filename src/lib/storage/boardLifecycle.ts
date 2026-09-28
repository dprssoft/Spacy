import { deleteBoardData } from './boardDoc';
import * as boardsRepo from './boardsRepo';

// Whole-board deletion lives here (not in boardsRepo) because boardDoc imports boardsRepo.
// UI code deletes boards only through these functions.

/** Permanently deletes a board: content, metadata and assets. */
export async function destroyBoard(id: string): Promise<void> {
	await deleteBoardData(id);
	await boardsRepo.destroy(id);
}

/** Permanently deletes boards that have been in the trash longer than `days`. */
export async function purgeExpiredTrash(now = Date.now(), days = 30): Promise<string[]> {
	const ids = await boardsRepo.expiredTrash(now, days);
	for (const id of ids) await destroyBoard(id);
	return ids;
}
