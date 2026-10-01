import { toast } from 'svelte-sonner';
import { newElementBase } from '$lib/model/defaults';
import { newId } from '$lib/model/ids';
import { createElements } from '$lib/model/ops';
import type { NewElement, Point } from '$lib/model/types';
import * as assetsRepo from '$lib/storage/assetsRepo';
import type { BoardContext } from '../context';
import { visibleWorldRect } from '../engine/viewport';
import { getDefaultStyle } from '../style/styleDefaults';

type Size = { w: number; h: number };

export const ACCEPTED_TYPES = [
	'image/png',
	'image/jpeg',
	'image/gif',
	'image/webp',
	'image/svg+xml'
];
export const MAX_BYTES = 20 * 1024 * 1024;
export const MAX_SIDE = 2048;
const CASCADE = 24;

/** Natural size scaled down (never up) to fit within `box`. */
export function fitWithin(natural: Size, box: Size): Size {
	const s = Math.min(1, box.w / natural.w, box.h / natural.h);
	return { w: natural.w * s, h: natural.h * s };
}

/** Size after limiting the longest side to `max` (keeps the aspect ratio). */
export function capSize(natural: Size, max = MAX_SIDE): Size {
	const s = Math.min(1, max / Math.max(natural.w, natural.h));
	return { w: Math.round(natural.w * s), h: Math.round(natural.h * s) };
}

export function validateImage(file: Blob): string | null {
	if (!ACCEPTED_TYPES.includes(file.type)) return 'Unsupported image type';
	if (file.size > MAX_BYTES) return 'Image is larger than 20 MB';
	return null;
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(blob);
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve(img);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Could not read the image'));
		};
		img.src = url;
	});
}

/** Decodes an image; large raster images are downscaled (GIFs keep animation, SVGs stay vector). */
async function prepare(file: Blob): Promise<{ blob: Blob; size: Size }> {
	const img = await loadImage(file);
	const natural = { w: img.naturalWidth || 300, h: img.naturalHeight || 150 };
	const capped = capSize(natural);
	const resizable = file.type !== 'image/gif' && file.type !== 'image/svg+xml';
	if (!resizable || (capped.w === natural.w && capped.h === natural.h)) {
		return { blob: file, size: natural };
	}
	const canvas = document.createElement('canvas');
	canvas.width = capped.w;
	canvas.height = capped.h;
	canvas.getContext('2d')?.drawImage(img, 0, 0, capped.w, capped.h);
	const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.9));
	return { blob: blob ?? file, size: capped };
}

/**
 * Stores image files as board assets and adds them centered on `at` (several cascade), sized to fit
 * half the visible area. One undo step; the new images become the selection.
 */
export async function importImageFiles(
	ctx: BoardContext,
	files: File[],
	at: Point
): Promise<string[]> {
	const view = visibleWorldRect(ctx.viewport.vp, ctx.viewport.size);
	const els: NewElement[] = [];
	for (const file of files) {
		const problem = validateImage(file);
		if (problem) {
			toast.error(`${file.name}: ${problem}`);
			continue;
		}
		try {
			const { blob, size } = await prepare(file);
			const assetId = await assetsRepo.put(ctx.id, blob, { width: size.w, height: size.h });
			const { w, h } = fitWithin(size, { w: view.w * 0.5, h: view.h * 0.5 });
			const offset = els.length * CASCADE;
			els.push({
				...newElementBase('image', newId(), at, getDefaultStyle('image')),
				x: at.x - w / 2 + offset,
				y: at.y - h / 2 + offset,
				w,
				h,
				type: 'image',
				assetId,
				naturalW: size.w,
				naturalH: size.h
			});
		} catch {
			toast.error(`${file.name}: could not read the image`);
		}
	}
	if (els.length === 0) return [];
	ctx.undo.stopCapturing();
	const created = createElements(ctx.doc, els);
	ctx.undo.stopCapturing();
	ctx.tools.setTool('select');
	ctx.selection.set(created.map((e) => e.id));
	return created.map((e) => e.id);
}

/** Opens the system file picker and imports the chosen images at the view center. */
export function openImagePicker(ctx: BoardContext): void {
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = ACCEPTED_TYPES.join(',');
	input.multiple = true;
	input.onchange = () => {
		const files = [...(input.files ?? [])];
		const view = visibleWorldRect(ctx.viewport.vp, ctx.viewport.size);
		if (files.length)
			void importImageFiles(ctx, files, { x: view.x + view.w / 2, y: view.y + view.h / 2 });
	};
	input.click();
}
