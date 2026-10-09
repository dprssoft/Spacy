import { toast } from 'svelte-sonner';
import * as boardsRepo from '$lib/storage/boardsRepo';
import type { BoardMeta } from '$lib/storage/types';

// Start-page board actions: storage call + user feedback. Errors surface as toasts.
// Board content code (Yjs, the data model) loads only when an action needs it.

async function attempt(action: () => Promise<void>, failure: string): Promise<void> {
	try {
		await action();
	} catch (err) {
		console.error(err);
		toast.error(failure);
	}
}

export const setStarred = (board: BoardMeta, starred: boolean) =>
	attempt(() => boardsRepo.setStarred(board.id, starred), 'Couldn’t update the board');

export const rename = (board: BoardMeta, title: string) =>
	attempt(async () => {
		const { renameBoard } = await import('$lib/storage/boardLifecycle');
		await renameBoard(board.id, title);
	}, 'Couldn’t rename the board');

export const duplicate = (board: BoardMeta) =>
	attempt(async () => {
		const { duplicateBoard } = await import('$lib/storage/boardDoc');
		await duplicateBoard(board.id);
		toast.success('Board duplicated');
	}, 'Couldn’t duplicate the board');

export const moveToTrash = (board: BoardMeta) =>
	attempt(async () => {
		await boardsRepo.trash(board.id);
		toast('Moved to trash', {
			description: board.title,
			action: { label: 'Undo', onClick: () => void restore(board, false) }
		});
	}, 'Couldn’t move the board to trash');

export const restore = (board: BoardMeta, announce = true) =>
	attempt(async () => {
		await boardsRepo.restore(board.id);
		if (announce) toast.success('Board restored');
	}, 'Couldn’t restore the board');

export const deleteForever = (boards: BoardMeta[]) =>
	attempt(async () => {
		const { destroyBoard } = await import('$lib/storage/boardLifecycle');
		for (const b of boards) await destroyBoard(b.id);
		toast.success(boards.length === 1 ? 'Board deleted' : `${boards.length} boards deleted`);
	}, 'Couldn’t delete the board');

export function openInNewTab(href: string): void {
	window.open(href, '_blank', 'noopener');
}
