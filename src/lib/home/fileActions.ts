import { toast } from 'svelte-sonner';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { downloadBlob } from '$lib/shared/download';
import { slug } from '$lib/shared/slug';
import type { BoardMeta } from '$lib/storage/types';

// Export/import code loads on first use (it isn't needed to show the start page).
const fileFormat = () => import('$lib/storage/fileFormat');

const MB = 1024 * 1024;

/** Imports `.smthng` files one after another; always creates new boards. */
export async function importFiles(files: Iterable<File>): Promise<BoardMeta[]> {
	const imported: BoardMeta[] = [];
	const { importFile, InvalidFileError } = await fileFormat();
	for (const file of files) {
		try {
			const result = await importFile(file, {
				confirmLarge: (f) =>
					confirm(
						`“${f.name}” is ${Math.round(f.size / MB)} MB. Importing it may take a while. Continue?`
					)
			});
			imported.push(...result.boards);
			for (const w of result.warnings) toast.warning(`${file.name}: ${w}`);
		} catch (err) {
			if (!(err instanceof InvalidFileError)) console.error(err);
			const reason = err instanceof InvalidFileError ? err.message : 'something went wrong';
			toast.error(`Couldn’t import ${file.name}: ${reason}`);
		}
	}
	if (imported.length === 0) return imported;
	const only = imported.length === 1 ? imported[0] : undefined;
	toast.success(only ? `Imported “${only.title}”` : `Imported ${imported.length} boards`, {
		action: only
			? { label: 'Open', onClick: () => void goto(resolve('/board/[id]', { id: only.id })) }
			: undefined
	});
	return imported;
}

/**
 * Files the installed app was opened with (File Handling API): import them, and open the board
 * when there is exactly one.
 */
export function handleLaunchFiles(): void {
	window.launchQueue?.setConsumer((params) => {
		if (params.files.length === 0) return;
		void (async () => {
			const files = await Promise.all(params.files.map((h) => h.getFile()));
			const boards = await importFiles(files);
			const only = boards.length === 1 ? boards[0] : undefined;
			if (only) await goto(resolve('/board/[id]', { id: only.id }));
		})();
	});
}

export async function exportBoard(board: Pick<BoardMeta, 'id' | 'title'>): Promise<void> {
	try {
		const { exportBoardFile } = await fileFormat();
		downloadBlob(await exportBoardFile(board.id), `${slug(board.title) || 'board'}.smthng`);
	} catch (err) {
		console.error(err);
		toast.error('Couldn’t export the board');
	}
}

export async function backupAll(): Promise<void> {
	try {
		const date = new Date().toISOString().slice(0, 10);
		const { exportBackup } = await fileFormat();
		downloadBlob(await exportBackup(), `smthng-backup-${date}.smthng`);
		toast.success('Backup downloaded');
	} catch (err) {
		console.error(err);
		toast.error('Couldn’t create the backup');
	}
}

/** True when a drag carries files (not text or elements from the page). */
export const dragHasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files');
