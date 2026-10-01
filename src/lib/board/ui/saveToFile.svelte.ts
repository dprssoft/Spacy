import { toast } from 'svelte-sonner';
import { downloadBlob } from '$lib/shared/download';
import { slug } from '$lib/shared/slug';
import { exportBoardFile } from '$lib/storage/fileFormat';

// The File System Access API (Chromium). Typed locally: not in TypeScript's DOM lib yet.
interface WritableFile {
	write(data: Blob): Promise<void>;
	close(): Promise<void>;
}
interface FileHandle {
	name: string;
	createWritable(): Promise<WritableFile>;
}
type SavePicker = (opts: {
	suggestedName: string;
	types: { description: string; accept: Record<string, string[]> }[];
}) => Promise<FileHandle>;

const picker = (): SavePicker | null => {
	const w = globalThis as unknown as { showSaveFilePicker?: SavePicker };
	return typeof w.showSaveFilePicker === 'function' ? w.showSaveFilePicker.bind(globalThis) : null;
};

export const canSaveToFile = (): boolean => picker() !== null;

const fileName = (title: string) => `${slug(title) || 'board'}.smthng`;

export async function downloadBoardFile(boardId: string, title: string): Promise<void> {
	try {
		downloadBlob(await exportBoardFile(boardId), fileName(title));
	} catch (err) {
		console.error(err);
		toast.error('Couldn’t export the board');
	}
}

/** "Save to file…": the first save asks where; later saves in this session rewrite that file. */
class SaveTarget {
	/** Per board: the file picked this session. */
	handles = $state<Record<string, FileHandle>>({});

	label(boardId: string): string {
		const h = this.handles[boardId];
		return h ? `Save to ${h.name}` : 'Save to file…';
	}

	async save(boardId: string, title: string): Promise<void> {
		const show = picker();
		if (!show) return;
		try {
			let handle = this.handles[boardId];
			if (!handle) {
				handle = await show({
					suggestedName: fileName(title),
					types: [{ description: 'SMTHNG board', accept: { 'application/json': ['.smthng'] } }]
				});
				this.handles[boardId] = handle;
			}
			const out = await handle.createWritable();
			await out.write(await exportBoardFile(boardId));
			await out.close();
			toast.success(`Saved to ${handle.name}`);
		} catch (err) {
			if (err instanceof DOMException && err.name === 'AbortError') return; // cancelled
			console.error(err);
			toast.error('Couldn’t save the file');
		}
	}
}

export const saveTarget = new SaveTarget();
