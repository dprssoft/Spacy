import { toast } from 'svelte-sonner';
import type { Point } from '$lib/model/types';
import type { BoardContext } from '../context';
import { syncFrameMembership } from '../frameMembership';
import { importImageFiles } from '../images/importImages';
import { docFileKind, isImageFile } from './fileKinds';

/** Whether a dropped or picked file can be added to the board. */
export const canImport = (file: File) => isImageFile(file) || docFileKind(file) !== null;

/**
 * Adds dropped files at `at`: images as images; text, Markdown and Word files as doc cards.
 * Everything added becomes the selection.
 */
export async function importFiles(ctx: BoardContext, files: File[], at: Point): Promise<string[]> {
	const images = files.filter(isImageFile);
	const docs = files.filter((f) => !isImageFile(f) && docFileKind(f));
	const ids = images.length ? await importImageFiles(ctx, images, at) : [];
	if (docs.length) {
		const { importDocFiles } = await import('./importDocs');
		const offset = { x: at.x + ids.length * 24, y: at.y + ids.length * 24 };
		const created = await importDocFiles(ctx, docs, offset, (file, message) =>
			toast.error(`${file.name}: ${message}`)
		);
		syncFrameMembership(ctx, created);
		ids.push(...created);
	}
	if (ids.length) {
		ctx.tools.setTool('select');
		ctx.selection.set(ids);
	}
	return ids;
}
