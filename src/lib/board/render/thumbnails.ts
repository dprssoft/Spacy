import { LOCAL } from '$lib/model/origins';
import { debounce } from '$lib/shared/debounce';
import * as boardsRepo from '$lib/storage/boardsRepo';
import type { BoardContext } from '../context';
import { rasterize, renderScope } from './exportImage';

const W = 480;
const H = 300;
const PAD = 24;
const BG = '#f7f7f8';
const IDLE_MS = 10_000;

/** The whole board fitted into 480×300 on a light background (an empty board → background only). */
export async function renderThumbnail(ctx: BoardContext): Promise<Blob | null> {
	const out = await renderScope(ctx, { kind: 'board' }, { background: BG, padding: 0 });
	const draw = (c: CanvasRenderingContext2D, img?: HTMLImageElement) => {
		c.fillStyle = BG;
		c.fillRect(0, 0, W, H);
		if (!img || !out) return;
		const s = Math.min((W - 2 * PAD) / out.width, (H - 2 * PAD) / out.height, 2);
		const w = out.width * s;
		const h = out.height * s;
		c.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
	};
	const svg = out?.svg ?? `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>`;
	const webp = await rasterize(svg, W, H, 'image/webp', 0.8, (c, img) =>
		draw(c, out ? img : undefined)
	);
	return webp;
}

/**
 * Keeps the start-page thumbnail fresh: 10 s after the last local edit, when the tab is hidden,
 * and when the board is closed (fire and forget). Returns cleanup.
 */
export function trackThumbnail(ctx: BoardContext): () => void {
	let dirty = false;
	const save = () => {
		if (!dirty) return;
		dirty = false;
		void renderThumbnail(ctx)
			.then((blob) => (blob ? boardsRepo.setThumbnail(ctx.id, blob) : undefined))
			.catch((err: unknown) => console.error('Thumbnail failed', err));
	};
	const later = debounce(save, IDLE_MS);
	const onUpdate = (_u: Uint8Array, origin: unknown) => {
		if (origin !== LOCAL) return;
		dirty = true;
		later();
	};
	const onVisibility = () => {
		if (document.visibilityState === 'hidden') {
			later.cancel();
			save();
		}
	};
	ctx.doc.on('update', onUpdate);
	document.addEventListener('visibilitychange', onVisibility);
	return () => {
		ctx.doc.off('update', onUpdate);
		document.removeEventListener('visibilitychange', onVisibility);
		later.cancel();
		save();
	};
}
